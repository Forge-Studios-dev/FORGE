import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CommunityRoleGuard } from './community-role.guard';
import { CommunityRole, CommunityRoleType } from '../entities/community-role.entity';
import { Community } from '../entities/community.entity';
import { UserRole } from '../../users/entities/user.entity';
import { COMMUNITY_ROLES_KEY } from '../decorators/community-roles.decorator';

describe('CommunityRoleGuard', () => {
  let guard: CommunityRoleGuard;
  let roleRepository: { findOne: jest.Mock };
  let communityRepository: { findOne: jest.Mock };

  const reflector = {
    getAllAndOverride: jest.fn(),
  };

  const buildContext = (user?: { sub: string; role?: UserRole }, params: Record<string, string> = {}) => {
    const req = { user, params };
    return {
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as ExecutionContext;
  };

  beforeEach(async () => {
    roleRepository = { findOne: jest.fn() };
    communityRepository = {
      findOne: jest.fn().mockResolvedValue({ id: 'comm-1', creatorId: 'creator-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityRoleGuard,
        { provide: Reflector, useValue: reflector },
        { provide: getRepositoryToken(CommunityRole), useValue: roleRepository },
        { provide: getRepositoryToken(Community), useValue: communityRepository },
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue('OK'),
          },
        },
      ],
    }).compile();

    guard = module.get(CommunityRoleGuard);
    jest.clearAllMocks();
    communityRepository.findOne.mockResolvedValue({ id: 'comm-1', creatorId: 'creator-1' });
  });

  it('allows when no roles required', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    await expect(guard.canActivate(buildContext())).resolves.toBe(true);
  });

  it('allows platform admin', async () => {
    reflector.getAllAndOverride.mockReturnValue([CommunityRoleType.MODERATOR]);
    await expect(
      guard.canActivate(buildContext({ sub: 'admin-1', role: UserRole.ADMIN }, { communityId: 'comm-1' })),
    ).resolves.toBe(true);
  });

  it('allows community owner', async () => {
    reflector.getAllAndOverride.mockReturnValue([CommunityRoleType.MODERATOR]);
    await expect(
      guard.canActivate(buildContext({ sub: 'creator-1', role: UserRole.CREATOR }, { communityId: 'comm-1' })),
    ).resolves.toBe(true);
  });

  it('allows assigned moderator', async () => {
    reflector.getAllAndOverride.mockReturnValue([CommunityRoleType.MODERATOR]);
    roleRepository.findOne.mockResolvedValue({
      communityId: 'comm-1',
      userId: 'mod-1',
      role: CommunityRoleType.MODERATOR,
    });
    await expect(
      guard.canActivate(buildContext({ sub: 'mod-1', role: UserRole.USER }, { communityId: 'comm-1' })),
    ).resolves.toBe(true);
  });

  it('rejects user without required role', async () => {
    reflector.getAllAndOverride.mockReturnValue([CommunityRoleType.ADMIN]);
    roleRepository.findOne.mockResolvedValue({
      communityId: 'comm-1',
      userId: 'mod-1',
      role: CommunityRoleType.MODERATOR,
    });
    await expect(
      guard.canActivate(buildContext({ sub: 'mod-1', role: UserRole.USER }, { communityId: 'comm-1' })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows coach when coach role is required', async () => {
    reflector.getAllAndOverride.mockReturnValue([CommunityRoleType.COACH]);
    roleRepository.findOne.mockResolvedValue({
      communityId: 'comm-1',
      userId: 'coach-1',
      role: CommunityRoleType.COACH,
    });
    await expect(
      guard.canActivate(buildContext({ sub: 'coach-1', role: UserRole.USER }, { communityId: 'comm-1' })),
    ).resolves.toBe(true);
  });
});
