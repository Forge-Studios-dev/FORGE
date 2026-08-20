import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../modules/users/entities/user.entity';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let guard: RolesGuard;

  const ctx = (role: UserRole) =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user: { sub: 'u1', role } }),
      }),
    }) as ExecutionContext;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('allows when no roles are required', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(ctx(UserRole.USER))).toBe(true);
  });

  it('allows when user has a required role', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.CREATOR]);
    expect(guard.canActivate(ctx(UserRole.CREATOR))).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, expect.any(Array));
  });

  it('denies when user lacks required role', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
    expect(() => guard.canActivate(ctx(UserRole.USER))).toThrow(ForbiddenException);
  });

  it('denies (not throws unhandled) when roles are required but no user is on the request', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
    const noUserCtx = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({}) }),
    } as ExecutionContext;

    expect(() => guard.canActivate(noUserCtx)).toThrow(ForbiddenException);
  });
});
