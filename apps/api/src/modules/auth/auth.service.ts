import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { User, UserRole } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { MailService } from '../mail/mail.service';
import { toPublicUser } from '../users/user.mapper';

export type ClientSessionMeta = {
  userAgent?: string | null;
  ip?: string | null;
};

@Injectable()
export class AuthService {
  private readonly BCRYPT_ROUNDS = 12;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(PasswordResetToken)
    private readonly passwordResetRepository: Repository<PasswordResetToken>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  async signup(dto: SignupDto, meta?: ClientSessionMeta) {
    const emailNorm = dto.email.trim().toLowerCase();
    const existing = await this.userRepository.findOne({
      where: [{ email: emailNorm }, { username: dto.username }],
    });
    if (existing) {
      throw new BadRequestException(
        existing.email === emailNorm ? 'Email already registered' : 'Username already taken',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, this.BCRYPT_ROUNDS);
    const user = this.userRepository.create({
      email: dto.email.trim().toLowerCase(),
      username: dto.username,
      displayName: dto.displayName,
      passwordHash,
    });
    await this.userRepository.save(user);

    const tokens = await this.issueTokens(user, meta);
    void this.sendEmailVerification(user).catch(() => undefined);
    return tokens;
  }

  async login(dto: LoginDto, meta?: ClientSessionMeta) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) throw new UnauthorizedException('Invalid credentials');

    return this.issueTokens(user, meta);
  }

  async createImpersonationToken(adminId: string, targetUserId: string) {
    const admin = await this.userRepository.findOne({ where: { id: adminId } });
    if (!admin || admin.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can impersonate users');
    }

    const target = await this.userRepository.findOne({ where: { id: targetUserId } });
    if (!target) throw new NotFoundException('User not found');
    if (target.role === UserRole.ADMIN) {
      throw new ForbiddenException('Cannot impersonate another admin');
    }

    const secret = this.configService.get<string>('jwt.secret');
    const token = this.jwtService.sign(
      { sub: targetUserId, adminId, purpose: 'impersonate' },
      { secret, expiresIn: '120s' },
    );

    const webUrl = this.configService.get<string>('mail.webUrl') || 'http://localhost:3000';

    return {
      token,
      /** Hash fragment avoids token in server logs / Referer (consumed client-side only). */
      url: `${webUrl}/impersonate#token=${encodeURIComponent(token)}`,
      expiresInSeconds: 120,
      targetUser: {
        id: target.id,
        username: target.username,
        displayName: target.displayName,
      },
    };
  }

  async consumeImpersonationToken(rawToken: string, meta?: ClientSessionMeta) {
    const secret = this.configService.get<string>('jwt.secret');
    let payload: { sub?: string; adminId?: string; purpose?: string };
    try {
      payload = this.jwtService.verify(rawToken, { secret }) as typeof payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired impersonation link');
    }

    if (payload.purpose !== 'impersonate' || !payload.sub) {
      throw new UnauthorizedException('Invalid impersonation token');
    }

    const user = await this.userRepository.findOne({ where: { id: payload.sub } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === UserRole.ADMIN) {
      throw new ForbiddenException('Cannot impersonate admin accounts');
    }

    return this.issueTokens(user, meta);
  }

  async refreshWithToken(rawRefreshToken: string, meta?: ClientSessionMeta) {
    const tokenHash = this.hashToken(rawRefreshToken);
    const storedToken = await this.refreshTokenRepository.findOne({
      where: { tokenHash },
      relations: ['user'],
    });

    if (!storedToken) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (storedToken.revoked) {
      await this.refreshTokenRepository.update({ userId: storedToken.userId }, { revoked: true });
      throw new UnauthorizedException(
        'Refresh token reuse detected — sign in again on all devices',
      );
    }

    if (!storedToken.user || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.refreshTokenRepository.update(storedToken.id, { revoked: true });
    return this.issueTokens(storedToken.user, meta);
  }

  /** Revoke only the refresh token for this browser (from HttpOnly cookie or body). */
  async logoutCurrent(userId: string, rawRefreshToken: string | null) {
    if (!rawRefreshToken) {
      return this.logoutAll(userId);
    }
    const tokenHash = this.hashToken(rawRefreshToken);
    await this.refreshTokenRepository.update(
      { userId, tokenHash, revoked: false },
      { revoked: true },
    );
  }

  async logoutAll(userId: string) {
    await this.refreshTokenRepository.update(
      { userId, revoked: false },
      { revoked: true },
    );
  }

  async listSessions(userId: string) {
    return this.refreshTokenRepository.find({
      where: { userId, revoked: false },
      order: { createdAt: 'DESC' },
      take: 50,
      select: ['id', 'deviceLabel', 'userAgent', 'createdAt', 'expiresAt'],
    });
  }

  async revokeSession(userId: string, sessionId: string) {
    const res = await this.refreshTokenRepository.update(
      { id: sessionId, userId, revoked: false },
      { revoked: true },
    );
    if (!res.affected) throw new NotFoundException('Session not found');
    return { ok: true };
  }

  async forgotPassword(email: string) {
    const normalized = email.trim().toLowerCase();
    const user = await this.userRepository.findOne({ where: { email: normalized } });
    if (!user) return;

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await this.passwordResetRepository.save(
      this.passwordResetRepository.create({
        userId: user.id,
        tokenHash,
        expiresAt,
      }),
    );

    const webUrl = this.configService.get<string>('mail.webUrl') || 'http://localhost:3000';
    const link = `${webUrl}/reset-password?token=${rawToken}`;
    await this.mailService.sendMail(
      user.email,
      'Reset your FORGE password',
      `Open this link to reset your password (valid 1 hour):\n${link}`,
    );
  }

  async resetPassword(rawToken: string, newPassword: string) {
    const tokenHash = this.hashToken(rawToken);
    const row = await this.passwordResetRepository.findOne({
      where: { tokenHash },
    });
    if (!row || row.usedAt || row.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset link');
    }

    const user = await this.userRepository.findOne({ where: { id: row.userId } });
    if (!user) throw new BadRequestException('Invalid reset link');

    user.passwordHash = await bcrypt.hash(newPassword, this.BCRYPT_ROUNDS);
    await this.userRepository.save(user);

    row.usedAt = new Date();
    await this.passwordResetRepository.save(row);

    await this.refreshTokenRepository.update({ userId: user.id }, { revoked: true });
  }

  async resendVerification(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.isVerified) return { ok: true, alreadyVerified: true };
    await this.sendEmailVerification(user);
    return { ok: true };
  }

  async verifyEmail(rawToken: string) {
    const tokenHash = this.hashToken(rawToken);
    const user = await this.userRepository.findOne({
      where: { emailVerificationTokenHash: tokenHash },
    });
    if (!user || !user.emailVerificationExpiresAt || user.emailVerificationExpiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired verification link');
    }
    user.isVerified = true;
    user.emailVerificationTokenHash = null;
    user.emailVerificationExpiresAt = null;
    await this.userRepository.save(user);
    return { ok: true };
  }

  private async sendEmailVerification(user: User) {
    const rawToken = randomBytes(32).toString('hex');
    user.emailVerificationTokenHash = this.hashToken(rawToken);
    user.emailVerificationExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    await this.userRepository.save(user);

    const webUrl = this.configService.get<string>('mail.webUrl') || 'http://localhost:3000';
    const link = `${webUrl}/verify-email?token=${rawToken}`;
    await this.mailService.sendMail(
      user.email,
      'Verify your FORGE email',
      `Confirm your email address:\n${link}\n\nThis link expires in 48 hours.`,
    );
  }

  private async issueTokens(user: User, meta?: ClientSessionMeta) {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.secret'),
      expiresIn: this.configService.get<string>('jwt.expiresIn'),
    });

    const rawRefreshToken = randomBytes(64).toString('hex');
    const tokenHash = this.hashToken(rawRefreshToken);
    const refreshExpiresIn = this.configService.get<string>('jwt.refreshExpiresIn') || '7d';
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parseInt(refreshExpiresIn, 10));

    const deviceLabel = this.deriveDeviceLabel(meta?.userAgent);
    const ipHash = meta?.ip ? this.hashToken(meta.ip).slice(0, 128) : null;

    const session = await this.refreshTokenRepository.save(
      this.refreshTokenRepository.create({
        userId: user.id,
        tokenHash,
        expiresAt,
        userAgent: meta?.userAgent ?? null,
        deviceLabel,
        ipHash,
      }),
    );

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      sessionId: session.id,
      user: toPublicUser(user),
    };
  }

  private deriveDeviceLabel(userAgent?: string | null): string | null {
    if (!userAgent) return null;
    if (userAgent.length <= 120) return userAgent;
    return `${userAgent.slice(0, 117)}...`;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
