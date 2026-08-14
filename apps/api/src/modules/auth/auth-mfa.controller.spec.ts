import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthMfaService } from './auth-mfa.service';
import { AuthOAuthExchangeService } from './auth-oauth-exchange.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AppCheckGuard } from '../firebase/app-check.guard';

describe('AuthController MFA endpoints', () => {
  let controller: AuthController;

  const authService = {
    login: jest.fn(),
    completeMfaLogin: jest.fn(),
    assertPasswordValid: jest.fn(),
  };
  const authMfaService = {
    beginEnrollment: jest.fn(),
    confirmEnrollment: jest.fn(),
    disable: jest.fn(),
  };
  const configService = { get: jest.fn() };
  const notificationsService = {};
  const oauthExchangeService = {};

  const res: { cookie: jest.Mock; clearCookie: jest.Mock } = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: ConfigService, useValue: configService },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: AuthOAuthExchangeService, useValue: oauthExchangeService },
        { provide: AuthMfaService, useValue: authMfaService },
      ],
    })
      .overrideGuard(AppCheckGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AuthController);
  });

  it('enrollMfa delegates to AuthMfaService.beginEnrollment for the current user', async () => {
    authMfaService.beginEnrollment.mockResolvedValue({ secret: 's', otpauthUri: 'uri' });
    const result = await controller.enrollMfa({ sub: 'user-1' } as never);
    expect(authMfaService.beginEnrollment).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({ secret: 's', otpauthUri: 'uri' });
  });

  it('verifyMfa delegates to AuthMfaService.confirmEnrollment', async () => {
    authMfaService.confirmEnrollment.mockResolvedValue({ backupCodes: ['a', 'b'] });
    const result = await controller.verifyMfa({ sub: 'user-1' } as never, { code: '123456' });
    expect(authMfaService.confirmEnrollment).toHaveBeenCalledWith('user-1', '123456');
    expect(result.backupCodes).toEqual(['a', 'b']);
  });

  it('disableMfa checks the password before disabling', async () => {
    const result = await controller.disableMfa({ sub: 'user-1' } as never, {
      currentPassword: 'pw',
    });
    expect(authService.assertPasswordValid).toHaveBeenCalledWith('user-1', 'pw');
    expect(authMfaService.disable).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({ ok: true });
  });

  it('login returns the MFA challenge as-is without setting auth cookies', async () => {
    authService.login.mockResolvedValue({ mfaRequired: true, challengeToken: 'chal.jwt' });
    const req = { headers: {}, ip: '127.0.0.1', socket: {} } as never;

    const result = await controller.login({ email: 'a@b.com', password: 'x' } as never, req, res as never);

    expect(result).toEqual({ mfaRequired: true, challengeToken: 'chal.jwt' });
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('mfaLoginVerify sets auth cookies and returns tokens on success', async () => {
    authService.completeMfaLogin.mockResolvedValue({
      accessToken: 'at',
      refreshToken: 'rt',
      sessionId: 'sid',
      user: { role: 'user' },
    });
    const req = { headers: {}, ip: '127.0.0.1', socket: {} } as never;

    const result = await controller.mfaLoginVerify(
      { challengeToken: 'chal.jwt', code: '123456' },
      req,
      res as never,
    );

    expect(authService.completeMfaLogin).toHaveBeenCalledWith('chal.jwt', '123456', {
      userAgent: null,
      ip: '127.0.0.1',
    });
    expect(result.accessToken).toBe('at');
  });
});
