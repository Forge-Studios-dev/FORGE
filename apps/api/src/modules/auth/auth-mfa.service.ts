import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import type { Redis } from 'ioredis';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { authenticator } from 'otplib';
import { User } from '../users/entities/user.entity';
import { decryptWithKey, encryptWithKey } from '../../common/utils/encryption.util';
import { safeRedisDel, safeRedisGetResult, safeRedisSetex } from '../../common/redis/redis-safe.util';

const BACKUP_CODE_COUNT = 10;
const MAX_VERIFY_ATTEMPTS = 5;
const ATTEMPTS_TTL_SEC = 600;

@Injectable()
export class AuthMfaService {
  private readonly logger = new Logger(AuthMfaService.name);

  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  private encryptionKey(): string | undefined {
    return this.configService.get<string>('mfa.encryptionKey') || undefined;
  }

  private attemptsKey(userId: string): string {
    return `auth:mfa_attempts:${userId}`;
  }

  /** Starts (or restarts) enrollment. Not active until confirmEnrollment succeeds. */
  async beginEnrollment(userId: string): Promise<{ secret: string; otpauthUri: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const secret = authenticator.generateSecret();
    user.mfaSecretEncrypted = encryptWithKey(secret, this.encryptionKey());
    user.mfaEnabled = false;
    user.mfaBackupCodeHashes = null;
    await this.userRepository.save(user);

    const otpauthUri = authenticator.keyuri(user.email, 'FORGE', secret);
    return { secret, otpauthUri };
  }

  /** Verifies the first code and activates MFA, returning single-use backup codes (shown once). */
  async confirmEnrollment(userId: string, code: string): Promise<{ backupCodes: string[] }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user?.mfaSecretEncrypted) {
      throw new BadRequestException('No MFA enrollment in progress — call enroll first');
    }

    const secret = decryptWithKey(user.mfaSecretEncrypted, this.encryptionKey());
    if (!authenticator.check(code.trim(), secret)) {
      throw new BadRequestException('Invalid verification code');
    }

    const backupCodes = Array.from({ length: BACKUP_CODE_COUNT }, () =>
      randomBytes(5).toString('hex'),
    );
    user.mfaBackupCodeHashes = await Promise.all(backupCodes.map((c) => bcrypt.hash(c, 10)));
    user.mfaEnabled = true;
    await this.userRepository.save(user);

    return { backupCodes };
  }

  async disable(userId: string): Promise<void> {
    await this.userRepository.update(userId, {
      mfaEnabled: false,
      mfaSecretEncrypted: null,
      mfaBackupCodeHashes: null,
    });
  }

  /** Verifies a login-time TOTP or single-use backup code. Rate-limited per user; consumes the backup code on match. */
  async verifyLoginCode(userId: string, code: string): Promise<boolean> {
    const attemptsResult = await safeRedisGetResult(
      this.redis,
      this.attemptsKey(userId),
      this.logger,
    );
    const attempts = attemptsResult.ok ? parseInt(attemptsResult.value || '0', 10) : 0;
    if (attempts >= MAX_VERIFY_ATTEMPTS) {
      throw new BadRequestException('Too many attempts. Try again later.');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user?.mfaEnabled || !user.mfaSecretEncrypted) {
      throw new BadRequestException('MFA is not enabled for this account');
    }

    const trimmed = code.trim();
    const secret = decryptWithKey(user.mfaSecretEncrypted, this.encryptionKey());
    if (authenticator.check(trimmed, secret)) {
      await safeRedisDel(this.redis, this.attemptsKey(userId), this.logger);
      return true;
    }

    const backupHashes = user.mfaBackupCodeHashes ?? [];
    for (let i = 0; i < backupHashes.length; i++) {
      if (await bcrypt.compare(trimmed, backupHashes[i])) {
        const remaining = [...backupHashes];
        remaining.splice(i, 1);
        await this.userRepository.update(userId, { mfaBackupCodeHashes: remaining });
        await safeRedisDel(this.redis, this.attemptsKey(userId), this.logger);
        return true;
      }
    }

    await safeRedisSetex(
      this.redis,
      this.attemptsKey(userId),
      ATTEMPTS_TTL_SEC,
      String(attempts + 1),
      this.logger,
    );
    return false;
  }
}
