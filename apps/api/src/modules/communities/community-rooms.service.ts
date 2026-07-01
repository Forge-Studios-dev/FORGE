import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
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
  /** Set when a TEXT room was auto-created for post-live discussion of a stream. */
  sourceStreamId?: string;
};

@Injectable()
export class CommunityRoomsService {
  constructor(
    @InjectRepository(Community) private readonly communityRepository: Repository<Community>,
    @InjectRepository(CommunityRoom) private readonly roomRepository: Repository<CommunityRoom>,
    private readonly livekitService: CommunityRoomLivekitService,
    @Inject(forwardRef(() => CommunitiesService))
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

  private async assertCommunityStudio(
    actorId: string,
    communityId: string,
    viewerRole?: UserRole | null,
  ) {
    return this.communitiesService.assertCommunityStudioAccess(actorId, communityId, viewerRole);
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
      community.id,
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

  /** Validates room belongs to community, tier gate, and room-level VIEW permission. */
  async assertRoomAccess(
    communityId: string,
    roomId: string,
    userId: string | null | undefined,
    viewerRole?: UserRole | null,
  ): Promise<CommunityRoom> {
    const community = await this.communitiesService.assertCommunityAccess(
      communityId,
      userId,
      viewerRole,
    );
    const room = await this.roomRepository.findOne({
      where: { id: roomId, communityId, isActive: true },
    });
    if (!room) throw new NotFoundException('Room not found');

    const settings = this.roomSettings(room);
    const canModerate = userId
      ? await this.communitiesService.canModerateCommunity(
          communityId,
          community.creatorId,
          userId,
          viewerRole,
        )
      : false;
    await this.assertRoomTierAccess(community, userId ?? '', settings, canModerate);
    await this.roomPermissionsService.assertRoomPermissionIfRestricted(
      communityId,
      roomId,
      userId,
      CommunityRoomPermission.VIEW,
      viewerRole,
    );
    return room;
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
      categoryId?: string;
    },
    viewerRole?: UserRole | null,
  ) {
    await this.assertCommunityStudio(creatorId, communityId, viewerRole);
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
        categoryId: input.categoryId ?? null,
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

  /**
   * Idempotently create a TEXT discussion room for continued conversation after
   * a live stream ends ("after-live discussion room"). Reuses the standard
   * community-room infrastructure (permissions, moderation, messaging, sockets).
   *
   * Authorization mirrors creator-studio access: the stream host must own or
   * manage the community the stream is linked to. Returns the existing room if
   * one was already created for this stream (safe to call from a retried/duplicate
   * `stream.ended` event).
   */
  async ensureAfterLiveRoom(
    hostUserId: string,
    communityId: string,
    streamId: string,
    streamTitle?: string | null,
  ): Promise<CommunityRoom> {
    await this.assertCommunityStudio(hostUserId, communityId);

    const existing = await this.roomRepository
      .createQueryBuilder('room')
      .where('room.communityId = :communityId', { communityId })
      .andWhere("room.settings ->> 'sourceStreamId' = :streamId", { streamId })
      .getOne();
    if (existing) return existing;

    const baseName = (streamTitle?.trim() || 'Live').slice(0, 160);
    const name = `${baseName} — discussion`.slice(0, 200);
    // Disambiguate slug with a short stream suffix so concurrent/identical
    // titles never collide on the unique (community, slug) pair.
    const slug = this.slugify(`${baseName}-live-${streamId.slice(0, 8)}`);

    const settings: RoomSettings = { sourceStreamId: streamId };
    const room = await this.roomRepository.save(
      this.roomRepository.create({
        communityId,
        name,
        slug,
        roomType: CommunityRoomType.TEXT,
        description: 'Continue the conversation from the live stream.',
        sortOrder: 0,
        isActive: true,
        settings,
      }),
    );
    return room;
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

  async updateRoom(
    actorId: string,
    communityId: string,
    roomId: string,
    input: {
      name?: string;
      description?: string;
      maxParticipants?: number;
      sortOrder?: number;
      requiredTierId?: string | null;
      categoryId?: string | null;
    },
    viewerRole?: UserRole | null,
  ) {
    await this.assertCommunityStudio(actorId, communityId, viewerRole);
    const room = await this.roomRepository.findOne({
      where: { id: roomId, communityId, isActive: true },
    });
    if (!room) throw new NotFoundException('Room not found');

    if (input.name?.trim()) {
      room.name = input.name.trim();
      room.slug = this.slugify(input.name);
    }
    if (input.description !== undefined) room.description = input.description?.trim() || null;
    if (input.maxParticipants !== undefined) room.maxParticipants = input.maxParticipants;
    if (input.sortOrder !== undefined) room.sortOrder = input.sortOrder;
    if (input.categoryId !== undefined) room.categoryId = input.categoryId;

    const settings = this.roomSettings(room);
    if (input.requiredTierId !== undefined) {
      if (input.requiredTierId) settings.requiredTierId = input.requiredTierId;
      else delete settings.requiredTierId;
      room.settings = settings;
    }

    await this.roomRepository.save(room);
    return { data: room };
  }

  async deactivateRoom(
    actorId: string,
    communityId: string,
    roomId: string,
    viewerRole?: UserRole | null,
  ) {
    await this.assertCommunityStudio(actorId, communityId, viewerRole);
    const room = await this.roomRepository.findOne({ where: { id: roomId, communityId } });
    if (!room) throw new NotFoundException('Room not found');
    room.isActive = false;
    await this.roomRepository.save(room);
    await this.redis.del(this.raiseHandKey(roomId), this.stageSpeakersKey(roomId));
    return { data: { id: room.id, isActive: false } };
  }
}
