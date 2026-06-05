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

describe('AuthService', () => {
  const userRepoMock = {
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    create: jest.fn((x) => x),
  };
  const refreshRepoMock = {
    create: jest.fn((x) => x),
    save: jest.fn(),
    update: jest.fn(),
    findOne: jest.fn(),
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
          provide: DataSource,
          useValue: {
            transaction: jest.fn(async (work) => work({
              save: jest.fn(async (x) => x),
              create: jest.fn((_e, x) => x),
            })),
          },
        },
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
    refreshRepoMock.save.mockResolvedValue({});

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

  it('refreshWithToken rotates opaque refresh token', async () => {
    const user = { id: 'u1', email: 'a@b.com', role: 'user' } as User;
    refreshRepoMock.findOne.mockResolvedValue({
      id: 'rt1',
      user,
      expiresAt: new Date(Date.now() + 86400000),
      revoked: false,
    });
    refreshRepoMock.update.mockResolvedValue({});
    refreshRepoMock.save.mockResolvedValue({});

    const svc = await setupService();
    const result = await svc.refreshWithToken('opaque-refresh-token');

    expect(result.accessToken).toBe('access.jwt');
    expect(refreshRepoMock.update).toHaveBeenCalled();
    expect(refreshRepoMock.save).toHaveBeenCalled();
  });
});
