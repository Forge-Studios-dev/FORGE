import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CommunityRoomPermission,
  CommunityRoomPermissionRow,
} from './entities/community-room-message.entity';
import { CommunityRoom } from './entities/community-room.entity';
import { CommunitiesService } from './communities.service';
import { CreatorAuditService } from './creator-audit.service';
import { UserRole } from '../users/entities/user.entity';

@Injectable()
export class CommunityRoomPermissionsService {
  constructor(
    @InjectRepository(CommunityRoom) private readonly roomRepository: Repository<CommunityRoom>,
    @InjectRepository(CommunityRoomPermissionRow)
    private readonly permissionRepository: Repository<CommunityRoomPermissionRow>,
    private readonly communitiesService: CommunitiesService,
    private readonly auditService: CreatorAuditService,
  ) {}

  private async assertRoomOwner(creatorId: string, communityId: string, roomId: string) {
    const community = await this.communitiesService.assertOwnedCommunity(creatorId, communityId);
    const room = await this.roomRepository.findOne({
      where: { id: roomId, communityId, isActive: true },
    });
    if (!room) throw new NotFoundException('Room not found');
    return { community, room };
  }

  async listPermissions(creatorId: string, communityId: string, roomId: string) {
    await this.assertRoomOwner(creatorId, communityId, roomId);
    const rows = await this.permissionRepository.find({
      where: { roomId },
      order: { createdAt: 'ASC' },
    });
    return { data: rows };
  }

  async grantPermission(
    creatorId: string,
    communityId: string,
    roomId: string,
    userId: string,
    permission: CommunityRoomPermission,
  ) {
    await this.assertRoomOwner(creatorId, communityId, roomId);
    const existing = await this.permissionRepository.findOne({
      where: { roomId, userId, permission },
    });
    if (existing) return { data: existing };
    const row = await this.permissionRepository.save(
      this.permissionRepository.create({ roomId, userId, permission }),
    );
    await this.auditService.log({
      creatorId,
      actorId: creatorId,
      action: 'room.permission.grant',
      resourceType: 'room',
      resourceId: roomId,
      metadata: { userId, permission },
    });
    return { data: row };
  }

  async revokePermission(
    creatorId: string,
    communityId: string,
    roomId: string,
    userId: string,
    permission: CommunityRoomPermission,
  ) {
    await this.assertRoomOwner(creatorId, communityId, roomId);
    await this.permissionRepository.delete({ roomId, userId, permission });
    await this.auditService.log({
      creatorId,
      actorId: creatorId,
      action: 'room.permission.revoke',
      resourceType: 'room',
      resourceId: roomId,
      metadata: { userId, permission },
    });
    return { data: { revoked: true } };
  }

  async roomHasCustomPermissions(roomId: string): Promise<boolean> {
    const count = await this.permissionRepository.count({ where: { roomId } });
    return count > 0;
  }

  /** When a room has explicit permission rows, require matching grant (or creator/mod). */
  async assertRoomPermissionIfRestricted(
    communityId: string,
    roomId: string,
    userId: string | null | undefined,
    permission: CommunityRoomPermission,
    viewerRole?: UserRole | null,
  ) {
    const restricted = await this.roomHasCustomPermissions(roomId);
    if (!restricted) return;
    if (!userId) throw new ForbiddenException('Sign in required for this room');
    const ok = await this.hasRoomPermission(communityId, roomId, userId, permission, viewerRole);
    if (!ok) throw new ForbiddenException('You do not have permission for this room');
  }

  async hasRoomPermission(
    communityId: string,
    roomId: string,
    userId: string,
    permission: CommunityRoomPermission,
    viewerRole?: UserRole | null,
  ): Promise<boolean> {
    const community = await this.communitiesService.assertCommunityAccess(
      communityId,
      userId,
      viewerRole,
    );
    if (userId === community.creatorId) return true;
    const canModerate = await this.communitiesService.canModerateCommunity(
      communityId,
      community.creatorId,
      userId,
      viewerRole,
    );
    if (canModerate) return true;
    const row = await this.permissionRepository.findOne({
      where: { roomId, userId, permission },
    });
    return !!row;
  }
}
