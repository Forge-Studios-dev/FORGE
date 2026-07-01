import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { OptionalJwtAuthGuard } from './optional-jwt.guard';

describe('OptionalJwtAuthGuard', () => {
  let guard: OptionalJwtAuthGuard;

  const ctx = (authorization?: string) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization } }),
      }),
    }) as ExecutionContext;

  beforeEach(() => {
    guard = new OptionalJwtAuthGuard();
  });

  it('allows anonymous requests without Authorization header', () => {
    expect(guard.canActivate(ctx())).toBe(true);
  });

  it('validates JWT when Bearer token is present', async () => {
    const passportSpy = jest
      .spyOn(AuthGuard('jwt').prototype, 'canActivate')
      .mockResolvedValue(true);
    const context = ctx('Bearer token');
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(passportSpy).toHaveBeenCalledWith(context);
    passportSpy.mockRestore();
  });

  it('handleRequest returns undefined without Bearer header', () => {
    expect(guard.handleRequest(null, null, null, ctx())).toBeUndefined();
  });

  it('handleRequest returns user for valid Bearer token', () => {
    const user = { sub: 'user-1', role: 'user' };
    expect(guard.handleRequest(null, user, null, ctx('Bearer token'))).toBe(user);
  });

  it('handleRequest throws for invalid Bearer token', () => {
    expect(() => guard.handleRequest(null, null, null, ctx('Bearer bad'))).toThrow(
      UnauthorizedException,
    );
  });
});
