import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../modules/users/entities/user.entity';
import { ConsumerOnlyGuard } from './consumer-only.guard';

describe('ConsumerOnlyGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let guard: ConsumerOnlyGuard;

  const ctx = (opts: { role?: UserRole; controller?: string; isPublic?: boolean; adminRoute?: boolean }) => {
    let call = 0;
    reflector.getAllAndOverride.mockImplementation(() => {
      call += 1;
      if (call === 1) return opts.isPublic ?? false;
      if (call === 2) return opts.adminRoute ? [UserRole.ADMIN] : undefined;
      return undefined;
    });
    return {
      getHandler: () => ({}),
      getClass: () => ({ name: opts.controller ?? 'FeedController' }),
      switchToHttp: () => ({
        getRequest: () => ({ user: opts.role ? { sub: 'u1', role: opts.role } : undefined }),
      }),
    } as ExecutionContext;
  };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new ConsumerOnlyGuard(reflector as unknown as Reflector);
  });

  it('allows public routes', () => {
    expect(guard.canActivate(ctx({ isPublic: true, role: UserRole.ADMIN }))).toBe(true);
  });

  it('allows admin on routes that require ADMIN role', () => {
    expect(guard.canActivate(ctx({ role: UserRole.ADMIN, adminRoute: true }))).toBe(true);
  });

  it('allows admin on AuthController', () => {
    reflector.getAllAndOverride.mockReturnValueOnce(false).mockReturnValueOnce(undefined);
    const context = {
      getHandler: () => ({}),
      getClass: () => ({ name: 'AuthController' }),
      switchToHttp: () => ({ getRequest: () => ({ user: { role: UserRole.ADMIN } }) }),
    } as ExecutionContext;
    expect(guard.canActivate(context)).toBe(true);
  });

  it('blocks platform admin from consumer APIs', () => {
    reflector.getAllAndOverride.mockReturnValueOnce(false).mockReturnValueOnce(undefined);
    const context = {
      getHandler: () => ({}),
      getClass: () => ({ name: 'FeedController' }),
      switchToHttp: () => ({ getRequest: () => ({ user: { role: UserRole.ADMIN } }) }),
    } as ExecutionContext;
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('allows regular users on consumer APIs', () => {
    expect(guard.canActivate(ctx({ role: UserRole.USER }))).toBe(true);
  });
});
