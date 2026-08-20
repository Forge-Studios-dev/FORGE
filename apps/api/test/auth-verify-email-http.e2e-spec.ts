/**
 * Email verification (signup -> verify -> login) had zero test coverage
 * beyond decorator metadata. Real AuthController -> AuthService chain; only
 * TypeORM repositories and external services (mail, JWT signing) are mocked
 * (per forge-testing.md, no live DB/Redis). Covers valid / expired / reused
 * / already-verified token and OTP paths through the actual HTTP surface.
 */
import { ClassSerializerInterceptor, INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { AuthOAuthExchangeService } from '../src/modules/auth/auth-oauth-exchange.service';
import { AuthAccountLockoutService } from '../src/modules/auth/auth-account-lockout.service';
import { AuthEmailOtpService } from '../src/modules/auth/auth-email-otp.service';
import { AuthUserCacheService } from '../src/modules/auth/auth-user-cache.service';
import { AuthSessionCacheService } from '../src/modules/auth/auth-session-cache.service';
import { AuthMfaService } from '../src/modules/auth/auth-mfa.service';
import { User } from '../src/modules/users/entities/user.entity';
import { RefreshToken } from '../src/modules/auth/entities/refresh-token.entity';
import { PasswordResetToken } from '../src/modules/auth/entities/password-reset-token.entity';
import { OAuthAccount } from '../src/modules/auth/entities/oauth-account.entity';
import { MailService } from '../src/modules/mail/mail.service';
import { AnalyticsService } from '../src/modules/analytics/analytics.service';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { ReferralService } from '../src/modules/referral/referral.service';
import { FirebaseService } from '../src/modules/firebase/firebase.service';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

describe('Email verification HTTP (HIGH-06)', () => {
  let app: INestApplication;

  const userRepository = {
    findOne: jest.fn(),
    save: jest.fn(async (u: unknown) => u),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const emailOtpService = {
    isEnabled: jest.fn().mockReturnValue(false),
    issueOtp: jest.fn(),
    verifyOtp: jest.fn(),
  };
  const mailService = { sendMail: jest.fn().mockResolvedValue(undefined) };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: getRepositoryToken(RefreshToken), useValue: {} },
        { provide: getRepositoryToken(PasswordResetToken), useValue: {} },
        { provide: getRepositoryToken(OAuthAccount), useValue: {} },
        { provide: JwtService, useValue: { sign: jest.fn() } },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string) => (key === 'mail.webUrl' ? 'http://localhost:3000' : '')) },
        },
        { provide: MailService, useValue: mailService },
        { provide: AnalyticsService, useValue: { ingest: jest.fn().mockResolvedValue(undefined) } },
        {
          provide: AuthAccountLockoutService,
          useValue: {
            assertNotLocked: jest.fn().mockResolvedValue(undefined),
            recordFailedLogin: jest.fn().mockResolvedValue(undefined),
            clearFailures: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: AuthEmailOtpService, useValue: emailOtpService },
        {
          provide: AuthUserCacheService,
          useValue: { get: jest.fn(), set: jest.fn(), bust: jest.fn() },
        },
        {
          provide: AuthSessionCacheService,
          useValue: {
            markActive: jest.fn().mockResolvedValue(undefined),
            markRevoked: jest.fn().mockResolvedValue(undefined),
            assertSessionActive: jest.fn().mockResolvedValue(true),
          },
        },
        { provide: DataSource, useValue: { transaction: jest.fn() } },
        { provide: ReferralService, useValue: { claimReferral: jest.fn() } },
        { provide: AuthMfaService, useValue: { isEnabled: jest.fn().mockResolvedValue(false) } },
        // Not exercised by verify-email routes — stubbed like billing-webhook-http
        // stubs unrelated constructor deps. FirebaseService is needed because
        // AppCheckGuard (used on other controller routes) is still constructed
        // at module init.
        { provide: NotificationsService, useValue: {} },
        { provide: AuthOAuthExchangeService, useValue: {} },
        { provide: FirebaseService, useValue: {} },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: 'default_IORedisModuleConnectionToken', useValue: { set: jest.fn() } },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalInterceptors(
      new ClassSerializerInterceptor(app.get(Reflector)),
      new TransformInterceptor(),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /auth/verify-email (token link)', () => {
    it('200s and marks the user verified for a valid token', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 'u1',
        isVerified: false,
        emailVerificationTokenHash: 'hash',
        emailVerificationExpiresAt: new Date(Date.now() + 60_000),
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/verify-email')
        .query({ token: 'valid-token' })
        .expect(200);

      expect(res.body.data).toEqual({ ok: true });
      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isVerified: true }),
      );
    });

    it('400s for an expired token', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 'u1',
        isVerified: false,
        emailVerificationTokenHash: 'hash',
        emailVerificationExpiresAt: new Date(Date.now() - 60_000),
      });

      await request(app.getHttpServer())
        .get('/api/v1/auth/verify-email')
        .query({ token: 'expired-token' })
        .expect(400);

      expect(userRepository.save).not.toHaveBeenCalled();
    });

    it('400s for a reused/unknown token', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/api/v1/auth/verify-email')
        .query({ token: 'already-used-token' })
        .expect(400);

      expect(userRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('POST /auth/verify-email/otp', () => {
    it('200s and marks the user verified for a correct code', async () => {
      userRepository.findOne.mockResolvedValue({ id: 'u1', email: 'a@b.com', isVerified: false });
      emailOtpService.verifyOtp.mockResolvedValue(true);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/verify-email/otp')
        .send({ email: 'a@b.com', code: '123456' })
        .expect(200);

      expect(res.body.data).toEqual({ ok: true });
      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isVerified: true }),
      );
    });

    it('200s with alreadyVerified and does not consume the OTP if already verified', async () => {
      userRepository.findOne.mockResolvedValue({ id: 'u1', email: 'a@b.com', isVerified: true });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/verify-email/otp')
        .send({ email: 'a@b.com', code: '123456' })
        .expect(200);

      expect(res.body.data).toEqual({ ok: true, alreadyVerified: true });
      expect(emailOtpService.verifyOtp).not.toHaveBeenCalled();
    });
  });
});
