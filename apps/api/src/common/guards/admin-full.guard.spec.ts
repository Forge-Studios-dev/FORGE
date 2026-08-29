import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminFullGuard } from './admin-full.guard';
import { AdminTier, UserRole } from '../../modules/users/entities/user.entity';
import { JwtPayload } from '../../modules/auth/strategies/jwt.strategy';

describe('AdminFullGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;

  const guard = new AdminFullGuard(reflector);

  const ctx = (user?: Partial<JwtPayload>) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows when route does not require full admin', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(false);
    expect(guard.canActivate(ctx({ role: UserRole.ADMIN, adminTier: AdminTier.MODERATOR }))).toBe(true);
  });

  it('blocks moderators on full-admin routes', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(true);
    expect(() =>
      guard.canActivate(ctx({ role: UserRole.ADMIN, adminTier: AdminTier.MODERATOR })),
    ).toThrow(ForbiddenException);
  });

  it('allows full admins on full-admin routes', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(true);
    expect(guard.canActivate(ctx({ role: UserRole.ADMIN, adminTier: AdminTier.FULL }))).toBe(true);
  });
});
