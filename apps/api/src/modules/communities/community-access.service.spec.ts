import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CommunityAccessService } from './community-access.service';
import { CommunityRoleType } from './entities/community-role.entity';
import { UserRole } from '../users/entities/user.entity';

/**
 * Covers assertCommunityPermission — the delegated-role permission gate added
 * for #18 (COACH/MODERATOR studio access matching COMMUNITY-PERMISSION-MATRIX.md).
 * Direct construction (mirrors AccountStrikesService/CopyrightService style) since
 * this method only touches communityRepository + roleRepository.
 */
describe('CommunityAccessService — assertCommunityPermission', () => {
  const community = { id: 'comm-1', creatorId: 'creator-1' };
  const communityRepository = { findOne: jest.fn() };
  const roleRepository = { findOne: jest.fn() };

  const service = new CommunityAccessService(
    communityRepository as never,
    {} as never, // channelRepository
    {} as never, // memberRepository
    {} as never, // communityMemberRepository
    roleRepository as never,
    {} as never, // entitlementsService
    {} as never, // engagementService
    {} as never, // moderationService
    {} as never, // redis
  );

  beforeEach(() => {
    jest.clearAllMocks();
    communityRepository.findOne.mockResolvedValue(community);
  });

  it('throws NotFoundException when the community does not exist', async () => {
    communityRepository.findOne.mockResolvedValue(null);
    await expect(
      service.assertCommunityPermission('user-1', 'comm-1', 'view_analytics'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows a platform ADMIN regardless of community role', async () => {
    roleRepository.findOne.mockResolvedValue(null);
    const result = await service.assertCommunityPermission(
      'admin-1',
      'comm-1',
      'view_analytics',
      UserRole.ADMIN,
    );
    expect(result).toBe(community);
  });

  it('allows the literal community owner regardless of delegated role rows', async () => {
    roleRepository.findOne.mockResolvedValue(null);
    const result = await service.assertCommunityPermission('creator-1', 'comm-1', 'view_analytics');
    expect(result).toBe(community);
  });

  it('allows a delegated COACH to view_analytics (matrix-documented permission)', async () => {
    roleRepository.findOne.mockResolvedValue({ role: CommunityRoleType.COACH });
    const result = await service.assertCommunityPermission('coach-1', 'comm-1', 'view_analytics');
    expect(result).toBe(community);
  });

  it('allows a delegated MODERATOR to manage_events (matrix-documented permission)', async () => {
    roleRepository.findOne.mockResolvedValue({ role: CommunityRoleType.MODERATOR });
    const result = await service.assertCommunityPermission('mod-1', 'comm-1', 'manage_events');
    expect(result).toBe(community);
  });

  it('rejects a delegated MODERATOR requesting view_analytics (not in the matrix for that role)', async () => {
    roleRepository.findOne.mockResolvedValue({ role: CommunityRoleType.MODERATOR });
    await expect(
      service.assertCommunityPermission('mod-1', 'comm-1', 'view_analytics'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a user with no role assignment at all', async () => {
    roleRepository.findOne.mockResolvedValue(null);
    await expect(
      service.assertCommunityPermission('stranger-1', 'comm-1', 'view_analytics'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
