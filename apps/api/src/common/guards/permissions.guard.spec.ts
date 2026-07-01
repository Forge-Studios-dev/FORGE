import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';
import { Permission } from '../auth/permissions';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { CreatorStatus, User, UserRole } from '../../modules/users/entities/user.entity';
import { UsersService } from '../../modules/users/users.service';
import { PermissionsGuard } from './permissions.guard';
import { AUTH_USER_CLS_KEY } from '../cls/auth-cls.keys';

describe('PermissionsGuard', () => {
  let reflector: { getAllAndOverride: jest.Mock };
  let usersService: { findById: jest.Mock };
  let cls: { get: jest.Mock };
  let guard: PermissionsGuard;

  const verifiedCreator: User = {
    id: 'creator-1',
    role: UserRole.CREATOR,
    creatorStatus: CreatorStatus.APPROVED,
    isVerified: true,
    isActive: true,
  } as User;

  const ctx = (user?: { sub: string; role: UserRole }) =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as ExecutionContext;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    usersService = { findById: jest.fn() };
    cls = { get: jest.fn() };
    guard = new PermissionsGuard(
      reflector as unknown as Reflector,
      usersService as unknown as UsersService,
      cls as unknown as ClsService,
    );
  });

  it('allows when no permissions are required', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    await expect(guard.canActivate(ctx())).resolves.toBe(true);
  });

  it('requires authentication when permissions are required', async () => {
    reflector.getAllAndOverride.mockReturnValue([Permission.UPLOAD_VIDEO]);
    await expect(guard.canActivate(ctx())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('allows creator with upload permission', async () => {
    reflector.getAllAndOverride.mockReturnValue([Permission.UPLOAD_VIDEO]);
    cls.get.mockReturnValue(verifiedCreator);
    await expect(
      guard.canActivate(ctx({ sub: 'creator-1', role: UserRole.CREATOR })),
    ).resolves.toBe(true);
    expect(cls.get).toHaveBeenCalledWith(AUTH_USER_CLS_KEY);
  });

  it('loads user from database when CLS snapshot missing', async () => {
    reflector.getAllAndOverride.mockReturnValue([Permission.UPLOAD_VIDEO]);
    cls.get.mockReturnValue(undefined);
    usersService.findById.mockResolvedValue(verifiedCreator);
    await expect(
      guard.canActivate(ctx({ sub: 'creator-1', role: UserRole.CREATOR })),
    ).resolves.toBe(true);
    expect(usersService.findById).toHaveBeenCalledWith('creator-1');
  });

  it('denies viewer without upload permission', async () => {
    reflector.getAllAndOverride.mockReturnValue([Permission.UPLOAD_VIDEO]);
    usersService.findById.mockResolvedValue({
      id: 'user-1',
      role: UserRole.USER,
      isVerified: true,
      isActive: true,
    } as User);
    await expect(
      guard.canActivate(ctx({ sub: 'user-1', role: UserRole.USER })),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(PERMISSIONS_KEY, expect.any(Array));
  });

  it('returns email verification code when engage blocked for unverified user', async () => {
    reflector.getAllAndOverride.mockReturnValue([Permission.ENGAGE]);
    usersService.findById.mockResolvedValue({
      id: 'user-1',
      role: UserRole.USER,
      isVerified: false,
      isActive: true,
    } as User);
    await expect(
      guard.canActivate(ctx({ sub: 'user-1', role: UserRole.USER })),
    ).rejects.toMatchObject({
      response: { code: 'EMAIL_NOT_VERIFIED' },
    });
  });
});
