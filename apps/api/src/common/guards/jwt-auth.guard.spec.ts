import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from './jwt-auth.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

describe('JwtAuthGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let guard: JwtAuthGuard;

  const fullCtx = () =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as ExecutionContext;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new JwtAuthGuard(reflector as unknown as Reflector);
  });

  it('allows @Public routes without invoking passport', () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    expect(guard.canActivate(fullCtx())).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, expect.any(Array));
  });

  it('delegates to passport for protected routes', () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const passportSpy = jest
      .spyOn(AuthGuard('jwt').prototype, 'canActivate')
      .mockReturnValue(true);
    const context = fullCtx();
    expect(guard.canActivate(context)).toBe(true);
    expect(passportSpy).toHaveBeenCalledWith(context);
    passportSpy.mockRestore();
  });

  it('handleRequest returns user when authenticated', () => {
    const user = { sub: 'user-1', role: 'user' };
    expect(guard.handleRequest(null, user)).toBe(user);
  });

  it('handleRequest throws UnauthorizedException when user missing', () => {
    expect(() => guard.handleRequest(null, null)).toThrow(UnauthorizedException);
  });

  it('handleRequest rethrows passport errors', () => {
    const err = new Error('jwt malformed');
    expect(() => guard.handleRequest(err, null)).toThrow(err);
  });
});
