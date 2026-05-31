import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppCheckGuard } from './app-check.guard';
import { APP_CHECK_KEY } from './app-check.decorator';

describe('AppCheckGuard', () => {
  const firebase = { verifyAppCheckToken: jest.fn() };
  let configGet: jest.Mock;
  let reflector: Reflector;

  function createGuard() {
    configGet = jest.fn();
    reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector;
    return new AppCheckGuard(
      reflector,
      firebase as never,
      { get: configGet } as never,
    );
  }

  const ctx = (headers: Record<string, string>) =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ headers }),
      }),
    }) as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows when App Check not required on handler', async () => {
    const guard = createGuard();
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(false);
    await expect(guard.canActivate(ctx({}))).resolves.toBe(true);
  });

  it('allows when App Check disabled in config', async () => {
    const guard = createGuard();
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(true);
    configGet.mockReturnValue(false);
    await expect(guard.canActivate(ctx({}))).resolves.toBe(true);
  });

  it('rejects missing token when enabled', async () => {
    const guard = createGuard();
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(true);
    configGet.mockImplementation((key: string) => key === 'firebase.appCheckEnabled');
    await expect(guard.canActivate(ctx({}))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows valid token', async () => {
    const guard = createGuard();
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(true);
    configGet.mockImplementation((key: string) => key === 'firebase.appCheckEnabled');
    firebase.verifyAppCheckToken.mockResolvedValue(true);
    await expect(
      guard.canActivate(ctx({ 'x-firebase-appcheck': 'valid-token' })),
    ).resolves.toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(APP_CHECK_KEY, expect.any(Array));
  });
});
