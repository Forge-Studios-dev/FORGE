import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Repository } from 'typeorm';
import { Community } from './entities/community.entity';
import { CommunityRoom, CommunityRoomType } from './entities/community-room.entity';
import { CommunityRoomLivekitService } from './community-room-livekit.service';
import { CommunitiesService } from './communities.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { CommunityRoomPermissionsService } from './community-room-permissions.service';
import { CommunityRoomPermission } from './entities/community-room-message.entity';
import { UserRole } from '../users/entities/user.entity';

type RoomSettings = {
  livekitRoomName?: string;
  requiredTierId?: string;
  parentRoomId?: string;
};

@Injectable()
export class CommunityRoomsService {
  constructor(
    @InjectRepository(Community) private readonly communityRepository: Repository<Community>,
    @InjectRepository(CommunityRoom) private readonly roomRepository: Repository<CommunityRoom>,
    private readonly livekitService: CommunityRoomLivekitService,
    private readonly communitiesService: CommunitiesService,
    private readonly entitlementsService: EntitlementsService,
    private readonly roomPermissionsService: CommunityRoomPermissionsService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  private slugify(text: string): string {
    return text
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 120);
  }

  private raiseHandKey(roomId: string): string {
    return `community-room:raise-hand:${roomId}`;
  }

  private stageSpeakersKey(roomId: string): string {
    return `community-room:stage-speakers:${roomId}`;
  }

  private async assertCommunityOwner(creatorId: string, communityId: string) {
    const community = await this.communityRepository.findOne({ where: { id: communityId } });
    if (!community || community.creatorId !== creatorId) {
      throw new ForbiddenException('Community not found or not owned');
    }
    return community;
  }

  private roomSettings(room: CommunityRoom): RoomSettings {
    return (room.settings ?? {}) as RoomSettings;
  }

  private async assertRoomTierAccess(
    community: Community,
    userId: string,
    settings: RoomSettings,
    canModerate: boolean,
  ) {
    if (!settings.requiredTierId || canModerate || userId === community.creatorId) return;
    const ok = await this.entitlementsService.meetsTierRequirement(
      userId,
      community.creatorId,
      settings.requiredTierId,
    );
    if (!ok) {
      throw new ForbiddenException('This room requires a higher membership tier');
    }
  }

  private async resolveCanPublish(
    room: CommunityRoom,
    community: Community,
    userId: string,
    canModerate: boolean,
  ): Promise<boolean> {
    if (room.roomType === CommunityRoomType.STAGE) {
      if (canModerate || userId === community.creatorId) return true;
      return (await this.redis.sismember(this.stageSpeakersKey(room.id), userId)) === 1;
    }
    return (
      room.roomType === CommunityRoomType.VOICE || room.roomType === CommunityRoomType.BREAKOUT
    );
  }

  async listRooms(
    communityId: string,
    viewerId?: string | null,
    viewerRole?: UserRole | null,
  ) {
    await this.communitiesService.assertCommunityAccess(communityId, viewerId, viewerRole);
    const rooms = await this.roomRepository.find({
      where: { communityId, isActive: true },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    return { data: rooms };
  }

  async getRoom(
    communityId: string,
    roomId: string,
    viewerId?: string | null,
    viewerRole?: UserRole | null,
  ) {
    await this.communitiesService.assertCommunityAccess(communityId, viewerId, viewerRole);
    const room = await this.roomRepository.findOne({
      where: { id: roomId, communityId, isActive: true },
    });
    if (!room) throw new NotFoundException('Room not found');
    await this.roomPermissionsService.assertRoomPermissionIfRestricted(
      communityId,
      roomId,
      viewerId,
      CommunityRoomPermission.VIEW,
      viewerRole,
    );
    return { data: room };
  }

  async createRoom(
    creatorId: string,
    communityId: string,
    input: {
      name: string;
      roomType?: CommunityRoomType;
      description?: string;
      maxParticipants?: number;
      sortOrder?: number;
      requiredTierId?: string;
      parentRoomId?: string;
    },
  ) {
    await this.assertCommunityOwner(creatorId, communityId);
    const slug = this.slugify(input.name);
    const existing = await this.roomRepository.findOne({ where: { communityId, slug } });
    if (existing) throw new BadRequestException('Room slug already exists');

    const roomType = input.roomType ?? CommunityRoomType.TEXT;
    if (roomType !== CommunityRoomType.TEXT && !this.livekitService.isConfigured()) {
      throw new BadRequestException(
        `${roomType} rooms require LiveKit — configure LIVEKIT_URL or create a text room`,
      );
    }

    if (input.parentRoomId) {
      const parent = await this.roomRepository.findOne({
        where: { id: input.parentRoomId, communityId, isActive: true },
      });
      if (!parent) throw new BadRequestException('Parent room not found');
      if (parent.roomType === CommunityRoomType.TEXT) {
        throw new BadRequestException('Breakout rooms must attach to a voice or stage room');
      }
    }

    const settings: RoomSettings = {};
    if (input.requiredTierId) settings.requiredTierId = input.requiredTierId;
    if (input.parentRoomId) settings.parentRoomId = input.parentRoomId;

    const room = await this.roomRepository.save(
      this.roomRepository.create({
        communityId,
        name: input.name.trim(),
        slug,
        roomType,
        description: input.description?.trim() || null,
        maxParticipants: input.maxParticipants ?? null,
        sortOrder: input.sortOrder ?? 0,
        isActive: true,
        settings,
      }),
    );

    if (roomType !== CommunityRoomType.TEXT) {
      const livekitRoomName = await this.livekitService.ensureRoom(
        communityId,
        room.id,
        roomType,
        input.maxParticipants,
      );
      room.settings = { ...settings, livekitRoomName };
      await this.roomRepository.save(room);
    }

    return { data: room };
  }

  async joinRoomToken(
    userId: string,
    communityId: string,
    roomId: string,
    viewerRole?: UserRole | null,
    displayName?: string,
  ) {
    const community = await this.communitiesService.assertCommunityAccess(
      communityId,
      userId,
      viewerRole,
    );
    const room = await this.roomRepository.findOne({
      where: { id: roomId, communityId, isActive: true },
    });
    if (!room) throw new NotFoundException('Room not found');
    if (room.roomType === CommunityRoomType.TEXT) {
      throw new BadRequestException('Text rooms do not use LiveKit tokens');
    }

    const settings = this.roomSettings(room);
    const canModerate = await this.communitiesService.canModerateCommunity(
      communityId,
      community.creatorId,
      userId,
      viewerRole,
    );
    await this.assertRoomTierAccess(community, userId, settings, canModerate);
    await this.roomPermissionsService.assertRoomPermissionIfRestricted(
      communityId,
      roomId,
      userId,
      CommunityRoomPermission.VIEW,
      viewerRole,
    );
    const canPublish = await this.resolveCanPublish(room, community, userId, canModerate);

    const token = await this.livekitService.createJoinToken({
      communityId,
      roomId: room.id,
      userId,
      roomType: room.roomType,
      displayName,
      canPublish,
    });

    return {
      data: {
        ...token,
        canPublish,
        isHost: canModerate,
        roomType: room.roomType,
        roomName: room.name,
      },
    };
  }

  async raiseHand(
    userId: string,
    communityId: string,
    roomId: string,
    viewerRole?: UserRole | null,
  ) {
    await this.communitiesService.assertCommunityAccess(communityId, userId, viewerRole);
    const room = await this.roomRepository.findOne({
      where: { id: roomId, communityId, isActive: true },
    });
    if (!room) throw new NotFoundException('Room not found');
    if (room.roomType !== CommunityRoomType.STAGE) {
      throw new BadRequestException('Raise hand is only available in stage rooms');
    }
    const key = this.raiseHandKey(roomId);
    await this.redis.hset(key, userId, Date.now().toString());
    await this.redis.expire(key, 3600);
    return { data: { raised: true } };
  }

  async lowerHand(
    userId: string,
    communityId: string,
    roomId: string,
    viewerRole?: UserRole | null,
  ) {
    await this.communitiesService.assertCommunityAccess(communityId, userId, viewerRole);
    await this.redis.hdel(this.raiseHandKey(roomId), userId);
    return { data: { raised: false } };
  }

  async listRaisedHands(
    userId: string,
    communityId: string,
    roomId: string,
    viewerRole?: UserRole | null,
  ) {
    const community = await this.communitiesService.assertCommunityAccess(
      communityId,
      userId,
      viewerRole,
    );
    const canModerate = await this.communitiesService.canModerateCommunity(
      communityId,
      community.creatorId,
      userId,
      viewerRole,
    );
    if (!canModerate) throw new ForbiddenException('Only hosts can view raised hands');

    const raw = await this.redis.hgetall(this.raiseHandKey(roomId));
    const data = Object.entries(raw).map(([uid, ts]) => ({
      userId: uid,
      raisedAt: new Date(Number(ts)).toISOString(),
    }));
    return { data };
  }

  async approveStageSpeaker(
    actorId: string,
    communityId: string,
    roomId: string,
    targetUserId: string,
    viewerRole?: UserRole | null,
  ) {
    const community = await this.communitiesService.assertCommunityAccess(
      communityId,
      actorId,
      viewerRole,
    );
    const canModerate = await this.communitiesService.canModerateCommunity(
      communityId,
      community.creatorId,
      actorId,
      viewerRole,
    );
    if (!canModerate) throw new ForbiddenException('Only hosts can approve speakers');

    const room = await this.roomRepository.findOne({
      where: { id: roomId, communityId, isActive: true },
    });
    if (!room) throw new NotFoundException('Room not found');
    if (room.roomType !== CommunityRoomType.STAGE) {
      throw new BadRequestException('Speaker approval is only for stage rooms');
    }

    await this.redis.sadd(this.stageSpeakersKey(roomId), targetUserId);
    await this.redis.expire(this.stageSpeakersKey(roomId), 7200);
    await this.redis.hdel(this.raiseHandKey(roomId), targetUserId);
    return { data: { approved: true, userId: targetUserId } };
  }

  async deactivateRoom(creatorId: string, communityId: string, roomId: string) {
    await this.assertCommunityOwner(creatorId, communityId);
    const room = await this.roomRepository.findOne({ where: { id: roomId, communityId } });
    if (!room) throw new NotFoundException('Room not found');
    room.isActive = false;
    await this.roomRepository.save(room);
    await this.redis.del(this.raiseHandKey(roomId), this.stageSpeakersKey(roomId));
    return { data: { id: room.id, isActive: false } };
  }
}
