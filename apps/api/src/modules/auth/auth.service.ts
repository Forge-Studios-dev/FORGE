import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, createHmac, randomBytes } from 'crypto';
import { User, UserRole } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { OAuthAccount } from './entities/oauth-account.entity';
import { GoogleProfilePayload } from './strategies/google.strategy';
import { AnalyticsService } from '../analytics/analytics.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { MailService } from '../mail/mail.service';
import { toPublicUser } from '../users/user.mapper';
import { AuthAccountLockoutService } from './auth-account-lockout.service';
import { AuthEmailOtpService } from './auth-email-otp.service';
import { AuthUserCacheService } from './auth-user-cache.service';
import { AuthSessionCacheService } from './auth-session-cache.service';
import { isDisposableEmail } from './utils/disposable-email.util';
import { ReferralService } from '../referral/referral.service';

export type ClientSessionMeta = {
  userAgent?: string | null;
  ip?: string | null;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly BCRYPT_ROUNDS = 12;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(PasswordResetToken)
    private readonly passwordResetRepository: Repository<PasswordResetToken>,
    @InjectRepository(OAuthAccount)
    private readonly oauthAccountRepository: Repository<OAuthAccount>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    private readonly analyticsService: AnalyticsService,
    private readonly lockoutService: AuthAccountLockoutService,
    private readonly emailOtpService: AuthEmailOtpService,
    private readonly authUserCache: AuthUserCacheService,
    private readonly authSessionCache: AuthSessionCacheService,
    private readonly dataSource: DataSource,
    private readonly referralService: ReferralService,
  ) {}

  async signup(dto: SignupDto, meta?: ClientSessionMeta) {
    const emailNorm = dto.email.trim().toLowerCase();
    if (isDisposableEmail(emailNorm)) {
      throw new BadRequestException('Disposable email addresses are not allowed');
    }
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
    try {
      await this.sendEmailVerification(user);
    } catch (err) {
      this.logger.warn(
        `Verification email not sent on signup for ${user.email}: ${err instanceof Error ? err.message : err}`,
      );
    }
    void this.referralService.claimReferral(dto.referralCode, user.id).catch((err) =>
      this.logger.warn(
        `Referral claim failed for user ${user.id}: ${err instanceof Error ? err.message : err}`,
      ),
    );
    void this.analyticsService.ingest(user.id, {
      eventName: 'auth.signup',
      properties: { method: 'email', referralCode: dto.referralCode ?? null },
    });
    return tokens;
  }

  async login(dto: LoginDto, meta?: ClientSessionMeta) {
    const email = dto.email.trim().toLowerCase();
    await this.lockoutService.assertNotLocked(email);

    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      await this.lockoutService.recordFailedLogin(email, meta?.ip ?? null);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.deletedAt || user.isActive === false) {
      throw new ForbiddenException({
        message: 'This account has been disabled. Contact support if you believe this is an error.',
        code: 'ACCOUNT_DISABLED',
      });
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      const oauthOnly = await this.oauthAccountRepository.findOne({
        where: { userId: user.id, provider: 'google' },
      });
      await this.lockoutService.recordFailedLogin(email, meta?.ip ?? null);
      if (oauthOnly) {
        throw new UnauthorizedException({
          message: 'This account uses Google sign-in',
          code: 'USE_GOOGLE_SIGNIN',
        });
      }
      throw new UnauthorizedException('Invalid credentials');
    }

    if (this.configService.get<boolean>('auth.requireVerifiedLogin') && !user.isVerified) {
      throw new ForbiddenException({
        message: 'Verify your email before signing in',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    await this.lockoutService.clearFailures(email, meta?.ip ?? null);

    await this.recordNewDeviceIfNeeded(user.id, meta, 'email');
    const tokens = await this.issueTokens(user, meta);
    void this.analyticsService.ingest(user.id, {
      eventName: 'auth.login',
      properties: { method: 'email' },
    });
    return tokens;
  }

  async loginWithGoogle(profile: GoogleProfilePayload, meta?: ClientSessionMeta) {
    const provider = 'google';
    const oauth = await this.oauthAccountRepository.findOne({
      where: { provider, providerId: profile.providerId },
    });

    let user: User | null = null;
    if (oauth) {
      user = await this.userRepository.findOne({ where: { id: oauth.userId } });
    }
    if (!user) {
      user = await this.userRepository.findOne({ where: { email: profile.email } });
    }
    if (user?.deletedAt || user?.isActive === false) {
      throw new ForbiddenException({
        message: 'This account has been disabled',
        code: 'ACCOUNT_DISABLED',
      });
    }

    if (!user) {
      const username = await this.uniqueUsernameFromEmail(profile.email);
      const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), this.BCRYPT_ROUNDS);
      user = await this.dataSource.transaction(async (manager) => {
        const created = await manager.save(
          manager.create(User, {
            email: profile.email,
            username,
            displayName: profile.displayName,
            passwordHash,
            isVerified: true,
          }),
        );
        await manager.save(
          manager.create(OAuthAccount, {
            userId: created.id,
            provider,
            providerId: profile.providerId,
            email: profile.email,
          }),
        );
        return created;
      });
    } else if (!oauth) {
      await this.oauthAccountRepository.save(
        this.oauthAccountRepository.create({
          userId: user.id,
          provider,
          providerId: profile.providerId,
          email: profile.email,
        }),
      );
    }

    await this.recordNewDeviceIfNeeded(user.id, meta, 'google');
    const tokens = await this.issueTokens(user, meta);
    void this.analyticsService.ingest(user.id, {
      eventName: 'auth.login',
      properties: { method: 'google' },
    });
    return tokens;
  }

  private async uniqueUsernameFromEmail(email: string): Promise<string> {
    const base = email
      .split('@')[0]!
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .slice(0, 40);
    let candidate = base || 'user';
    for (let i = 0; i < 20; i++) {
      const taken = await this.userRepository.findOne({ where: { username: candidate } });
      if (!taken) return candidate;
      candidate = `${base}_${randomBytes(3).toString('hex')}`;
    }
    return `user_${randomBytes(6).toString('hex')}`;
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
    await this.authSessionCache.markRevoked(storedToken.id);
    return this.issueTokens(storedToken.user, meta);
  }

  /** Revoke only the refresh token for this browser (from HttpOnly cookie or body). */
  async logoutCurrent(userId: string, rawRefreshToken: string | null) {
    if (!rawRefreshToken) {
      return this.logoutAll(userId);
    }
    const tokenHash = this.hashToken(rawRefreshToken);
    const stored = await this.refreshTokenRepository.findOne({
      where: { userId, tokenHash, revoked: false },
      select: ['id'],
    });
    await this.refreshTokenRepository.update(
      { userId, tokenHash, revoked: false },
      { revoked: true },
    );
    if (stored?.id) {
      await this.authSessionCache.markRevoked(stored.id);
    }
  }

  async logoutAll(userId: string) {
    const activeSessions = await this.refreshTokenRepository.find({
      where: { userId, revoked: false },
      select: ['id'],
    });
    await this.refreshTokenRepository.update(
      { userId, revoked: false },
      { revoked: true },
    );
    await Promise.all(activeSessions.map((s) => this.authSessionCache.markRevoked(s.id)));
    await this.authUserCache.bust(userId);
  }

  async listSessions(userId: string) {
    return this.refreshTokenRepository.find({
      where: { userId, revoked: false },
      order: { createdAt: 'DESC' },
      take: 50,
      select: ['id', 'deviceLabel', 'userAgent', 'createdAt', 'expiresAt'],
    });
  }

  /** Device login history (same rows as active sessions — `createdAt` = sign-in time). */
  async listLoginHistory(userId: string) {
    const sessions = await this.listSessions(userId);
    return sessions.map((s) => ({
      id: s.id,
      deviceLabel: s.deviceLabel,
      userAgent: s.userAgent,
      loginAt: s.createdAt,
      expiresAt: s.expiresAt,
    }));
  }

  async revokeSession(userId: string, sessionId: string) {
    const res = await this.refreshTokenRepository.update(
      { id: sessionId, userId, revoked: false },
      { revoked: true },
    );
    if (!res.affected) throw new NotFoundException('Session not found');
    await this.authSessionCache.markRevoked(sessionId);
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

  /** Authenticated password change — verifies current password, then revokes other sessions. */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    keepSessionId?: string | null,
  ) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const passwordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    if (currentPassword === newPassword) {
      throw new BadRequestException('New password must be different from the current password');
    }

    user.passwordHash = await bcrypt.hash(newPassword, this.BCRYPT_ROUNDS);
    await this.userRepository.save(user);

    const activeSessions = await this.refreshTokenRepository.find({
      where: { userId, revoked: false },
      select: ['id'],
    });
    for (const session of activeSessions) {
      if (keepSessionId && session.id === keepSessionId) continue;
      await this.refreshTokenRepository.update(session.id, { revoked: true });
      await this.authSessionCache.markRevoked(session.id);
    }
    await this.authUserCache.bust(userId);
    return { ok: true };
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
    await this.markEmailVerified(user);
    return { ok: true };
  }

  async verifyEmailWithOtp(email: string, code: string) {
    const normalized = email.trim().toLowerCase();
    const user = await this.userRepository.findOne({ where: { email: normalized } });
    if (!user) {
      throw new BadRequestException('Invalid verification code');
    }
    if (user.isVerified) {
      return { ok: true, alreadyVerified: true };
    }
    await this.emailOtpService.verifyOtp(normalized, code);
    await this.markEmailVerified(user);
    return { ok: true };
  }

  private async markEmailVerified(user: User) {
    user.isVerified = true;
    user.emailVerificationTokenHash = null;
    user.emailVerificationExpiresAt = null;
    await this.userRepository.save(user);
  }

  private async sendEmailVerification(user: User) {
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    // Partial update avoids ORM issues when optional schema columns are mid-migration.
    await this.userRepository.update(user.id, {
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpiresAt: expiresAt,
    });

    const webUrl = this.configService.get<string>('mail.webUrl') || 'http://localhost:3000';
    const link = `${webUrl}/verify-email?token=${rawToken}`;
    let body = `Confirm your email address:\n${link}\n\nThis link expires in 48 hours.`;
    if (this.emailOtpService.isEnabled()) {
      try {
        const otp = await this.emailOtpService.issueOtp(user.email);
        body += `\n\nOr enter this 6-digit code on the verify page (valid 10 minutes):\n${otp}`;
      } catch (err) {
        this.logger.warn(
          `Email OTP skipped for ${user.email}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
    await this.mailService.sendMail(user.email, 'Verify your FORGE email', body);
  }

  private async issueTokens(user: User, meta?: ClientSessionMeta) {
    const rawRefreshToken = randomBytes(64).toString('hex');
    const tokenHash = this.hashToken(rawRefreshToken);
    const refreshExpiresIn = this.configService.get<string>('jwt.refreshExpiresIn') || '7d';
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parseInt(refreshExpiresIn, 10));

    const deviceLabel = this.deriveDeviceLabel(meta?.userAgent);
    const ipHash = meta?.ip ? this.hashIp(meta.ip).slice(0, 128) : null;

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

    await this.authSessionCache.markActive(session.id, user.id);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
      sid: session.id,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('jwt.secret'),
      expiresIn: this.configService.get<string>('jwt.expiresIn') as StringValue,
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      sessionId: session.id,
      user: toPublicUser(user),
    };
  }

  /** Flags sign-in from an IP not seen on any prior active session (suspicious-login signal). */
  private async recordNewDeviceIfNeeded(
    userId: string,
    meta: ClientSessionMeta | undefined,
    method: 'email' | 'google',
  ): Promise<void> {
    const ipHash = meta?.ip ? this.hashIp(meta.ip).slice(0, 128) : null;
    if (!ipHash) return;

    const prior = await this.refreshTokenRepository.find({
      where: { userId, revoked: false },
      select: ['ipHash'],
      take: 20,
    });
    const known = new Set(prior.map((s) => s.ipHash).filter((h): h is string => !!h));
    if (known.size === 0 || known.has(ipHash)) return;

    void this.analyticsService.ingest(userId, {
      eventName: 'auth.login.new_device',
      properties: { method },
    });
  }

  private deriveDeviceLabel(userAgent?: string | null): string | null {
    if (!userAgent) return null;
    if (userAgent.length <= 120) return userAgent;
    return `${userAgent.slice(0, 117)}...`;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * IPs are low-entropy (unlike refresh tokens), so a plain SHA-256 is
   * brute-forceable via a precomputed table. HMAC with the server-only
   * JWT secret closes that gap without a new env var.
   */
  private hashIp(ip: string): string {
    const secret = this.configService.get<string>('jwt.secret') || '';
    return createHmac('sha256', secret).update(ip).digest('hex');
  }
}
