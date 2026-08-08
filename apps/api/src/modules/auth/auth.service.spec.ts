import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { OAuthAccount } from './entities/oauth-account.entity';
import { MailService } from '../mail/mail.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { AuthAccountLockoutService } from './auth-account-lockout.service';
import { AuthEmailOtpService } from './auth-email-otp.service';
import { AuthUserCacheService } from './auth-user-cache.service';
import { AuthSessionCacheService } from './auth-session-cache.service';
import { ReferralService } from '../referral/referral.service';

describe('AuthService', () => {
  const userRepoMock = {
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    create: jest.fn((x) => x),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    })),
  };
  const refreshRepoMock = {
    create: jest.fn((x) => x),
    save: jest.fn(),
    update: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
  };
  const resetRepoMock = {
    save: jest.fn(),
    findOne: jest.fn(),
  };
  const oauthRepoMock = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn((x) => x),
  };
  const mailMock = { sendMail: jest.fn().mockResolvedValue(undefined) };
  const analyticsMock = { ingest: jest.fn().mockResolvedValue(undefined) };
  const lockoutMock = {
    assertNotLocked: jest.fn().mockResolvedValue(undefined),
    recordFailedLogin: jest.fn().mockResolvedValue(undefined),
    clearFailures: jest.fn().mockResolvedValue(undefined),
  };
  const emailOtpMock = {
    isEnabled: jest.fn().mockReturnValue(false),
    issueOtp: jest.fn().mockResolvedValue('123456'),
    verifyOtp: jest.fn().mockResolvedValue(true),
  };

  const jwtMock = {
    sign: jest.fn().mockReturnValue('access.jwt'),
  };

  const configMock = {
    get: jest.fn((key: string) => {
      const map: Record<string, string> = {
        'jwt.secret': 'test-secret',
        'jwt.expiresIn': '15m',
        'jwt.refreshExpiresIn': '7d',
        'mail.webUrl': 'http://localhost:3000',
      };
      return map[key] ?? '';
    }),
  };

  async function setupService() {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepoMock },
        { provide: getRepositoryToken(RefreshToken), useValue: refreshRepoMock },
        { provide: getRepositoryToken(PasswordResetToken), useValue: resetRepoMock },
        { provide: getRepositoryToken(OAuthAccount), useValue: oauthRepoMock },
        { provide: JwtService, useValue: jwtMock },
        { provide: ConfigService, useValue: configMock },
        { provide: MailService, useValue: mailMock },
        { provide: AnalyticsService, useValue: analyticsMock },
        { provide: AuthAccountLockoutService, useValue: lockoutMock },
        { provide: AuthEmailOtpService, useValue: emailOtpMock },
        { provide: AuthUserCacheService, useValue: { get: jest.fn(), set: jest.fn(), bust: jest.fn() } },
        {
          provide: AuthSessionCacheService,
          useValue: {
            markActive: jest.fn().mockResolvedValue(undefined),
            markRevoked: jest.fn().mockResolvedValue(undefined),
            assertSessionActive: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: DataSource,
          useValue: {
            query: jest.fn().mockResolvedValue(undefined),
            transaction: jest.fn(async (work) => work({
              save: jest.fn(async (x) => x),
              create: jest.fn((_e, x) => x),
            })),
          },
        },
        { provide: ReferralService, useValue: { claimReferral: jest.fn().mockResolvedValue(null) } },
      ],
    }).compile();
    return moduleRef.get(AuthService);
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('signup creates user and returns tokens', async () => {
    userRepoMock.findOne.mockResolvedValue(null);
    const savedUser = {
      id: 'u1',
      email: 'a@b.com',
      username: 'ab',
      displayName: 'AB',
      passwordHash: 'hash',
      role: 'user',
      isVerified: false,
      isActive: true,
      creatorStatus: null,
      creatorReviewNote: null,
      avatarUrl: null,
    } as unknown as User;
    userRepoMock.create.mockReturnValue(savedUser);
    userRepoMock.save.mockResolvedValue(savedUser);
    refreshRepoMock.save.mockResolvedValue({ id: 'sid-1' });

    const svc = await setupService();
    const result = await svc.signup(
      {
        email: 'A@B.com',
        username: 'ab',
        displayName: 'AB',
        password: 'Abcd1234',
        acceptedTerms: true,
      } as never,
      {},
    );

    expect(result.accessToken).toBe('access.jwt');
    expect(refreshRepoMock.save).toHaveBeenCalled();
    expect(mailMock.sendMail).toHaveBeenCalled();
  });

  it('forgotPassword is a no-op when user missing', async () => {
    userRepoMock.findOne.mockResolvedValue(null);
    const svc = await setupService();
    await svc.forgotPassword('missing@example.com');
    expect(resetRepoMock.save).not.toHaveBeenCalled();
  });

  describe('changePassword', () => {
    it('updates the hash and revokes other sessions', async () => {
      const bcrypt = await import('bcrypt');
      const hash = await bcrypt.hash('OldPass1a', 4);
      userRepoMock.findOne.mockResolvedValue({ id: 'u1', passwordHash: hash });
      userRepoMock.save.mockImplementation(async (u: unknown) => u);
      refreshRepoMock.find.mockResolvedValue([{ id: 'keep' }, { id: 'other' }]);
      refreshRepoMock.update.mockResolvedValue({});
      const svc = await setupService();
      const result = await svc.changePassword('u1', 'OldPass1a', 'NewPass1a', 'keep');
      expect(result).toEqual({ ok: true });
      expect(userRepoMock.save).toHaveBeenCalled();
      expect(refreshRepoMock.update).toHaveBeenCalledWith('other', { revoked: true });
      expect(refreshRepoMock.update).not.toHaveBeenCalledWith('keep', { revoked: true });
    });

    it('rejects an incorrect current password', async () => {
      const bcrypt = await import('bcrypt');
      const hash = await bcrypt.hash('OldPass1a', 4);
      userRepoMock.findOne.mockResolvedValue({ id: 'u1', passwordHash: hash });
      const svc = await setupService();
      await expect(svc.changePassword('u1', 'WrongPass1a', 'NewPass1a')).rejects.toThrow(
        /Current password is incorrect/,
      );
    });

    it('rejects when new password matches current', async () => {
      const bcrypt = await import('bcrypt');
      const hash = await bcrypt.hash('SamePass1a', 4);
      userRepoMock.findOne.mockResolvedValue({ id: 'u1', passwordHash: hash });
      const svc = await setupService();
      await expect(svc.changePassword('u1', 'SamePass1a', 'SamePass1a')).rejects.toThrow(
        /must be different/,
      );
    });
  });

  it('refreshWithToken rotates opaque refresh token', async () => {
    const user = { id: 'u1', email: 'a@b.com', role: 'user' } as User;
    refreshRepoMock.findOne.mockResolvedValue({
      id: 'rt1',
      user,
      expiresAt: new Date(Date.now() + 86400000),
      revoked: false,
    });
    refreshRepoMock.update.mockResolvedValue({});
    refreshRepoMock.save.mockResolvedValue({ id: 'sid-1' });

    const svc = await setupService();
    const result = await svc.refreshWithToken('opaque-refresh-token');

    expect(result.accessToken).toBe('access.jwt');
    expect(refreshRepoMock.update).toHaveBeenCalled();
    expect(refreshRepoMock.save).toHaveBeenCalled();
  });

  describe('verifyEmail (token link)', () => {
    it('marks the user verified for a valid, unexpired token', async () => {
      const user = {
        id: 'u1',
        isVerified: false,
        emailVerificationTokenHash: 'hash',
        emailVerificationExpiresAt: new Date(Date.now() + 60_000),
      } as unknown as User;
      userRepoMock.findOne.mockResolvedValue(user);
      userRepoMock.save.mockResolvedValue(user);

      const svc = await setupService();
      const result = await svc.verifyEmail('raw-token');

      expect(result).toEqual({ ok: true });
      expect(userRepoMock.save).toHaveBeenCalledWith(
        expect.objectContaining({
          isVerified: true,
          emailVerificationTokenHash: null,
          emailVerificationExpiresAt: null,
        }),
      );
    });

    it('rejects an expired token', async () => {
      userRepoMock.findOne.mockResolvedValue({
        id: 'u1',
        isVerified: false,
        emailVerificationTokenHash: 'hash',
        emailVerificationExpiresAt: new Date(Date.now() - 60_000),
      } as unknown as User);

      const svc = await setupService();
      await expect(svc.verifyEmail('raw-token')).rejects.toThrow(
        'Invalid or expired verification link',
      );
      expect(userRepoMock.save).not.toHaveBeenCalled();
    });

    it('rejects a reused or unknown token (no user has that hash)', async () => {
      // markEmailVerified clears the hash on first use, so a replayed token
      // simply won't match any user — same code path as "invalid".
      userRepoMock.findOne.mockResolvedValue(null);

      const svc = await setupService();
      await expect(svc.verifyEmail('already-used-token')).rejects.toThrow(
        'Invalid or expired verification link',
      );
      expect(userRepoMock.save).not.toHaveBeenCalled();
    });
  });

  describe('verifyEmailWithOtp', () => {
    it('marks the user verified for a correct code', async () => {
      const user = { id: 'u1', email: 'a@b.com', isVerified: false } as unknown as User;
      userRepoMock.findOne.mockResolvedValue(user);
      userRepoMock.save.mockResolvedValue(user);
      emailOtpMock.verifyOtp.mockResolvedValue(true);

      const svc = await setupService();
      const result = await svc.verifyEmailWithOtp('a@b.com', '123456');

      expect(result).toEqual({ ok: true });
      expect(emailOtpMock.verifyOtp).toHaveBeenCalledWith('a@b.com', '123456');
      expect(userRepoMock.save).toHaveBeenCalledWith(
        expect.objectContaining({ isVerified: true }),
      );
    });

    it('short-circuits without consuming the OTP when already verified', async () => {
      userRepoMock.findOne.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        isVerified: true,
      } as unknown as User);

      const svc = await setupService();
      const result = await svc.verifyEmailWithOtp('a@b.com', '123456');

      expect(result).toEqual({ ok: true, alreadyVerified: true });
      expect(emailOtpMock.verifyOtp).not.toHaveBeenCalled();
      expect(userRepoMock.save).not.toHaveBeenCalled();
    });

    it('rejects an unknown email', async () => {
      userRepoMock.findOne.mockResolvedValue(null);

      const svc = await setupService();
      await expect(svc.verifyEmailWithOtp('missing@example.com', '123456')).rejects.toThrow(
        'Invalid verification code',
      );
      expect(emailOtpMock.verifyOtp).not.toHaveBeenCalled();
    });

    it('propagates rejection for an invalid/expired code', async () => {
      userRepoMock.findOne.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        isVerified: false,
      } as unknown as User);
      emailOtpMock.verifyOtp.mockRejectedValue(new Error('Invalid or expired code'));

      const svc = await setupService();
      await expect(svc.verifyEmailWithOtp('a@b.com', '000000')).rejects.toThrow(
        'Invalid or expired code',
      );
      expect(userRepoMock.save).not.toHaveBeenCalled();
    });
  });

  describe('resendVerification', () => {
    it('is a no-op when already verified', async () => {
      userRepoMock.findOne.mockResolvedValue({ id: 'u1', isVerified: true } as unknown as User);

      const svc = await setupService();
      const result = await svc.resendVerification('u1');

      expect(result).toEqual({ ok: true, alreadyVerified: true });
      expect(mailMock.sendMail).not.toHaveBeenCalled();
    });

    it('sends a new verification email when unverified', async () => {
      userRepoMock.findOne.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        isVerified: false,
      } as unknown as User);

      const svc = await setupService();
      const result = await svc.resendVerification('u1');

      expect(result).toEqual({ ok: true });
      expect(mailMock.sendMail).toHaveBeenCalled();
    });
  });
});
