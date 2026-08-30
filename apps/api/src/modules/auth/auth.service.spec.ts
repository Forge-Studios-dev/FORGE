import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuthService } from './auth.service';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { OAuthAccount } from './entities/oauth-account.entity';
import { MailService } from '../mail/mail.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { AuthAccountLockoutService } from './auth-account-lockout.service';
import { AuthEmailOtpService } from './auth-email-otp.service';
import { AuthMfaService } from './auth-mfa.service';
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
  const refreshQueryBuilderMock = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const refreshRepoMock = {
    create: jest.fn((x) => x),
    save: jest.fn(),
    update: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
    createQueryBuilder: jest.fn(() => refreshQueryBuilderMock),
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
  const eventEmitterMock = { emit: jest.fn() };
  const redisMock = { set: jest.fn().mockResolvedValue('OK') };
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
    verify: jest.fn(),
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
        { provide: AuthMfaService, useValue: { verifyLoginCode: jest.fn() } },
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
        { provide: EventEmitter2, useValue: eventEmitterMock },
        { provide: 'default_IORedisModuleConnectionToken', useValue: redisMock },
      ],
    }).compile();
    return moduleRef.get(AuthService);
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it(
    'signup creates user and returns tokens',
    async () => {
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
    },
    15_000,
  );

  it('signup converts a concurrent unique-constraint race into a friendly 400', async () => {
    userRepoMock.findOne.mockResolvedValue(null);
    userRepoMock.create.mockReturnValue({ id: 'u1' } as unknown as User);
    userRepoMock.save.mockRejectedValue({ code: '23505' });

    const svc = await setupService();
    await expect(
      svc.signup(
        {
          email: 'a@b.com',
          username: 'ab',
          displayName: 'AB',
          password: 'Abcd1234',
          acceptedTerms: true,
        } as never,
        {},
      ),
    ).rejects.toThrow(/already taken/);
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
    refreshQueryBuilderMock.execute.mockResolvedValue({ affected: 1 });

    const svc = await setupService();
    const result = await svc.refreshWithToken('opaque-refresh-token');

    expect(result.accessToken).toBe('access.jwt');
    expect(refreshQueryBuilderMock.where).toHaveBeenCalledWith(
      'id = :id AND revoked = false',
      { id: 'rt1' },
    );
    expect(refreshRepoMock.save).toHaveBeenCalled();
  });

  it('refreshWithToken rejects the loser of a concurrent rotation race as reuse', async () => {
    const user = { id: 'u1', email: 'a@b.com', role: 'user' } as User;
    refreshRepoMock.findOne.mockResolvedValue({
      id: 'rt1',
      userId: 'u1',
      user,
      expiresAt: new Date(Date.now() + 86400000),
      revoked: false,
    });
    refreshQueryBuilderMock.execute.mockResolvedValue({ affected: 0 });

    const svc = await setupService();
    await expect(svc.refreshWithToken('opaque-refresh-token')).rejects.toThrow(/reuse detected/);
    expect(refreshRepoMock.update).toHaveBeenCalledWith({ userId: 'u1' }, { revoked: true });
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

  describe('login with MFA enabled', () => {
    it('returns a challenge token instead of real tokens, without issuing a session', async () => {
      const bcrypt = await import('bcrypt');
      const hash = await bcrypt.hash('CorrectPass1a', 4);
      userRepoMock.findOne.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        passwordHash: hash,
        mfaEnabled: true,
        isActive: true,
      });
      jwtMock.sign.mockReturnValue('challenge.jwt');

      const svc = await setupService();
      const result = await svc.login({ email: 'a@b.com', password: 'CorrectPass1a' } as never);

      expect(result).toEqual({ mfaRequired: true, challengeToken: 'challenge.jwt' });
      expect(refreshRepoMock.save).not.toHaveBeenCalled();
      expect(analyticsMock.ingest).not.toHaveBeenCalled();
    });
  });

  describe('suspicious-login detection', () => {
    async function loginFromNewIp(lastSessionCreatedAt: Date) {
      const bcrypt = await import('bcrypt');
      const hash = await bcrypt.hash('CorrectPass1a', 4);
      userRepoMock.findOne.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        passwordHash: hash,
        mfaEnabled: false,
        isActive: true,
      });
      refreshRepoMock.find.mockResolvedValue([
        { ipHash: 'some-other-known-ip-hash', createdAt: lastSessionCreatedAt },
      ]);
      refreshRepoMock.save.mockResolvedValue({ id: 'sid-1' });

      const svc = await setupService();
      await svc.login({ email: 'a@b.com', password: 'CorrectPass1a' } as never, { ip: '9.9.9.9' });
    }

    it('flags a rapid IP change as higher-risk when the last session was under 10 minutes ago', async () => {
      await loginFromNewIp(new Date(Date.now() - 2 * 60_000));

      expect(eventEmitterMock.emit).toHaveBeenCalledWith(
        'auth.login.suspicious',
        expect.objectContaining({ userId: 'u1', signal: 'rapid_ip_change', riskScore: 55 }),
      );
    });

    it('flags a plain new device (no rapid IP change) at lower risk', async () => {
      await loginFromNewIp(new Date(Date.now() - 60 * 60_000));

      expect(eventEmitterMock.emit).toHaveBeenCalledWith(
        'auth.login.suspicious',
        expect.objectContaining({ userId: 'u1', signal: 'new_device_login', riskScore: 25 }),
      );
    });

    it('does not flag a login from an already-known IP', async () => {
      const bcrypt = await import('bcrypt');
      const { createHmac } = await import('crypto');
      const hash = await bcrypt.hash('CorrectPass1a', 4);
      const knownIpHash = createHmac('sha256', 'test-secret').update('9.9.9.9').digest('hex');
      userRepoMock.findOne.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        passwordHash: hash,
        mfaEnabled: false,
        isActive: true,
      });
      refreshRepoMock.find.mockResolvedValue([{ ipHash: knownIpHash, createdAt: new Date() }]);
      refreshRepoMock.save.mockResolvedValue({ id: 'sid-1' });

      const svc = await setupService();
      await svc.login({ email: 'a@b.com', password: 'CorrectPass1a' } as never, { ip: '9.9.9.9' });

      expect(eventEmitterMock.emit).not.toHaveBeenCalledWith(
        'auth.login.suspicious',
        expect.anything(),
      );
    });

    it('does not flag a first-ever login with no prior session history', async () => {
      const bcrypt = await import('bcrypt');
      const hash = await bcrypt.hash('CorrectPass1a', 4);
      userRepoMock.findOne.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        passwordHash: hash,
        mfaEnabled: false,
        isActive: true,
      });
      refreshRepoMock.find.mockResolvedValue([]);
      refreshRepoMock.save.mockResolvedValue({ id: 'sid-1' });

      const svc = await setupService();
      await svc.login({ email: 'a@b.com', password: 'CorrectPass1a' } as never, { ip: '9.9.9.9' });

      expect(eventEmitterMock.emit).not.toHaveBeenCalledWith(
        'auth.login.suspicious',
        expect.anything(),
      );
    });
  });

  describe('impersonation token replay', () => {
    it('rejects replaying the same impersonation token twice', async () => {
      jwtMock.verify.mockReturnValue({
        sub: 'target-1',
        adminId: 'admin-1',
        purpose: 'impersonate',
        jti: 'jti-1',
      });
      userRepoMock.findOne.mockResolvedValue({
        id: 'target-1',
        email: 'target@b.com',
        role: 'user',
        isActive: true,
      });
      refreshRepoMock.save.mockResolvedValue({ id: 'sid-1' });

      const svc = await setupService();
      redisMock.set.mockResolvedValueOnce('OK'); // first exchange reserves the jti
      await svc.consumeImpersonationToken('valid.jwt');

      redisMock.set.mockResolvedValueOnce(null); // NX: jti already reserved
      await expect(svc.consumeImpersonationToken('valid.jwt')).rejects.toThrow(
        'Impersonation link already used',
      );
    });
  });

  describe('loginWithGoogle with MFA enabled', () => {
    it('returns a challenge token instead of real tokens, without issuing a session', async () => {
      oauthRepoMock.findOne.mockResolvedValue({ userId: 'u1', provider: 'google' });
      userRepoMock.findOne.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        mfaEnabled: true,
        isActive: true,
      });
      jwtMock.sign.mockReturnValue('challenge.jwt');

      const svc = await setupService();
      const result = await svc.loginWithGoogle({
        providerId: 'g-1',
        email: 'a@b.com',
        displayName: 'A',
      } as never);

      expect(result).toEqual({ mfaRequired: true, challengeToken: 'challenge.jwt' });
      expect(refreshRepoMock.save).not.toHaveBeenCalled();
      expect(analyticsMock.ingest).not.toHaveBeenCalled();
    });
  });

  describe('completeMfaLogin', () => {
    it('exchanges a valid challenge token + code for real tokens', async () => {
      jwtMock.sign.mockReturnValue('access.jwt');
      jwtMock.verify.mockReturnValue({ sub: 'u1', mfaChallenge: true });
      userRepoMock.findOne.mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        isActive: true,
        deletedAt: null,
      });
      refreshRepoMock.save.mockResolvedValue({ id: 'sid-1' });
      const mfaMock = { verifyLoginCode: jest.fn().mockResolvedValue(true) };

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
          { provide: AuthMfaService, useValue: mfaMock },
          { provide: AuthUserCacheService, useValue: { get: jest.fn(), set: jest.fn(), bust: jest.fn() } },
          {
            provide: AuthSessionCacheService,
            useValue: { markActive: jest.fn().mockResolvedValue(undefined) },
          },
          { provide: DataSource, useValue: { transaction: jest.fn() } },
          { provide: ReferralService, useValue: { claimReferral: jest.fn() } },
          { provide: EventEmitter2, useValue: eventEmitterMock },
          { provide: 'default_IORedisModuleConnectionToken', useValue: redisMock },
        ],
      }).compile();
      const svc = moduleRef.get(AuthService);

      const result = await svc.completeMfaLogin('challenge.jwt', '123456');

      expect(mfaMock.verifyLoginCode).toHaveBeenCalledWith('u1', '123456');
      expect(result.accessToken).toBe('access.jwt');
    });

    it('rejects an expired or malformed challenge token', async () => {
      jwtMock.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });
      const svc = await setupService();

      await expect(svc.completeMfaLogin('bad.jwt', '123456')).rejects.toThrow(
        'MFA challenge expired or invalid — log in again',
      );
    });

    it('rejects when the MFA code is wrong', async () => {
      jwtMock.verify.mockReturnValue({ sub: 'u1', mfaChallenge: true });
      userRepoMock.findOne.mockResolvedValue({ id: 'u1', isActive: true, deletedAt: null });
      const mfaMock = { verifyLoginCode: jest.fn().mockResolvedValue(false) };

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
          { provide: AuthMfaService, useValue: mfaMock },
          { provide: AuthUserCacheService, useValue: { get: jest.fn(), set: jest.fn(), bust: jest.fn() } },
          {
            provide: AuthSessionCacheService,
            useValue: { markActive: jest.fn().mockResolvedValue(undefined) },
          },
          { provide: DataSource, useValue: { transaction: jest.fn() } },
          { provide: ReferralService, useValue: { claimReferral: jest.fn() } },
          { provide: EventEmitter2, useValue: eventEmitterMock },
          { provide: 'default_IORedisModuleConnectionToken', useValue: redisMock },
        ],
      }).compile();
      const svc = moduleRef.get(AuthService);

      await expect(svc.completeMfaLogin('challenge.jwt', '000000')).rejects.toThrow(
        'Invalid verification code',
      );
    });
  });
});
