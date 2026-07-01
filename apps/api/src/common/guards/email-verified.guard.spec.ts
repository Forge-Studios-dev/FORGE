import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_VERIFIED_KEY } from '../decorators/require-verified.decorator';
import { UsersService } from '../../modules/users/users.service';
import { EmailVerifiedGuard } from './email-verified.guard';

describe('EmailVerifiedGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let usersService: { findById: jest.Mock };
  let guard: EmailVerifiedGuard;

  const ctx = (userId?: string) =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user: userId ? { sub: userId } : undefined }),
      }),
    }) as ExecutionContext;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    usersService = { findById: jest.fn() };
    guard = new EmailVerifiedGuard(
      reflector as unknown as Reflector,
      usersService as unknown as UsersService,
    );
  });

  it('allows when verification not required', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    await expect(guard.canActivate(ctx('user-1'))).resolves.toBe(true);
  });

  it('allows unauthenticated when verification required (jwt guard handles auth)', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    await expect(guard.canActivate(ctx())).resolves.toBe(true);
  });

  it('allows verified users', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    usersService.findById.mockResolvedValue({ id: 'user-1', isVerified: true });
    await expect(guard.canActivate(ctx('user-1'))).resolves.toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(REQUIRE_VERIFIED_KEY, expect.any(Array));
  });

  it('blocks unverified users', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    usersService.findById.mockResolvedValue({ id: 'user-1', isVerified: false });
    await expect(guard.canActivate(ctx('user-1'))).rejects.toMatchObject({
      response: { code: 'EMAIL_NOT_VERIFIED' },
    });
    await expect(guard.canActivate(ctx('user-1'))).rejects.toBeInstanceOf(ForbiddenException);
  });
});
