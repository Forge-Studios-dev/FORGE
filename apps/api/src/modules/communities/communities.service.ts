import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Community } from './entities/community.entity';
import { Channel } from './entities/channel.entity';
import { ChannelMember } from './entities/channel-member.entity';
import { ChannelMessage } from './entities/channel-message.entity';
import {
  CreateChannelDto,
  UpdateChannelDto,
  SendChannelMessageDto,
  InviteChannelMemberDto,
} from './dto/community.dto';
import { toPublicChannel, toPublicChannelMessage } from './community.mapper';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { ChannelType } from '../entitlements/entities/channel-type.enum';
import { UserRole } from '../users/entities/user.entity';

const DEFAULT_CHANNELS: Array<{ name: string; slug: string; type: ChannelType; sortOrder: number }> = [
  { name: 'Announcements', slug: 'announcements', type: ChannelType.PUBLIC, sortOrder: 0 },
  { name: 'General', slug: 'general', type: ChannelType.PUBLIC, sortOrder: 1 },
  { name: 'Live Discussion', slug: 'live-discussion', type: ChannelType.PUBLIC, sortOrder: 2 },
  { name: 'Premium Content', slug: 'premium-content', type: ChannelType.SUBSCRIBERS, sortOrder: 3 },
];

@Injectable()
export class CommunitiesService {
  constructor(
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    @InjectRepository(Channel)
    private readonly channelRepository: Repository<Channel>,
    @InjectRepository(ChannelMember)
    private readonly memberRepository: Repository<ChannelMember>,
    @InjectRepository(ChannelMessage)
    private readonly messageRepository: Repository<ChannelMessage>,
    private readonly entitlementsService: EntitlementsService,
    private readonly eventEmitter: EventEmitter2,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  @OnEvent('creator.approved')
  async seedCommunityOnApproval(payload: { userId: string }) {
    await this.ensureCommunity(payload.userId);
  }

  async ensureCommunity(creatorId: string): Promise<Community> {
    let community = await this.communityRepository.findOne({ where: { creatorId } });
    if (community) return community;

    community = await this.communityRepository.save(
      this.communityRepository.create({ creatorId, name: 'Community' }),
    );

    for (const def of DEFAULT_CHANNELS) {
      await this.channelRepository.save(
        this.channelRepository.create({
          communityId: community.id,
          ...def,
        }),
      );
    }

    return community;
  }

  async getCommunityByCreator(creatorId: string, viewerId?: string | null, viewerRole?: UserRole | null) {
    const community = await this.communityRepository.findOne({ where: { creatorId } });
    if (!community) {
      return { community: null, channels: [] };
    }

    const channels = await this.channelRepository.find({
      where: { communityId: community.id },
      order: { sortOrder: 'ASC' },
    });

    const isOwner = viewerId === creatorId;
    const isAdmin = viewerRole === UserRole.ADMIN;

    const inviteChannelIds = channels
      .filter((c) => c.type === ChannelType.INVITE)
      .map((c) => c.id);
    const memberChannelIds =
      viewerId && inviteChannelIds.length > 0
        ? await this.loadInviteMemberChannelIds(viewerId, inviteChannelIds)
        : new Set<string>();

    const accessList = await this.entitlementsService.checkChannelAccessMany(
      viewerId,
      viewerRole,
      channels.map((channel) => ({
        type: channel.type,
        requiredTierId: channel.requiredTierId,
        creatorId,
        isMember: memberChannelIds.has(channel.id),
      })),
      { isOwner, isAdmin },
    );

    const visible = channels
      .map((channel, index) => (accessList[index].allowed ? toPublicChannel(channel) : null))
      .filter(Boolean);

    return {
      community: { id: community.id, creatorId: community.creatorId, name: community.name },
      channels: visible.filter(Boolean),
    };
  }

  async createChannel(creatorId: string, dto: CreateChannelDto) {
    const community = await this.ensureCommunity(creatorId);
    const slug =
      dto.slug?.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-') ||
      dto.name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');

    const existing = await this.channelRepository.findOne({
      where: { communityId: community.id, slug },
    });
    if (existing) throw new BadRequestException('Channel slug already exists');

    const channel = await this.channelRepository.save(
      this.channelRepository.create({
        communityId: community.id,
        name: dto.name.trim(),
        slug,
        type: dto.type ?? ChannelType.PUBLIC,
        requiredTierId: dto.requiredTierId ?? null,
        sortOrder: dto.sortOrder ?? 99,
      }),
    );

    return toPublicChannel(channel);
  }

  async updateChannel(creatorId: string, channelId: string, dto: UpdateChannelDto) {
    const channel = await this.getOwnedChannel(creatorId, channelId);
    if (dto.name !== undefined) channel.name = dto.name.trim();
    if (dto.type !== undefined) channel.type = dto.type;
    if (dto.requiredTierId !== undefined) channel.requiredTierId = dto.requiredTierId;
    if (dto.sortOrder !== undefined) channel.sortOrder = dto.sortOrder;
    const saved = await this.channelRepository.save(channel);
    return toPublicChannel(saved);
  }

  async inviteMember(creatorId: string, channelId: string, dto: InviteChannelMemberDto) {
    const channel = await this.getOwnedChannel(creatorId, channelId);
    if (channel.type !== ChannelType.INVITE) {
      throw new BadRequestException('Channel is not invite-only');
    }
    await this.memberRepository.save(
      this.memberRepository.create({ channelId: channel.id, userId: dto.userId }),
    );
    return { ok: true };
  }

  async getChannelMessages(
    channelId: string,
    viewerId: string | null | undefined,
    viewerRole: UserRole | null | undefined,
    limit = 50,
    cursor?: string,
  ) {
    const channel = await this.getChannelWithCommunity(channelId);
    await this.assertChannelAccess(channel, viewerId, viewerRole);

    const query = this.messageRepository
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.user', 'user')
      .where('m.channel_id = :channelId', { channelId })
      .orderBy('m.created_at', 'DESC')
      .take(limit + 1);

    if (cursor) {
      const cursorDate = new Date(Buffer.from(cursor, 'base64').toString('utf-8'));
      query.andWhere('m.created_at < :cursor', { cursor: cursorDate });
    }

    const messages = await query.getMany();
    const hasMore = messages.length > limit;
    const data = hasMore ? messages.slice(0, limit) : messages;
    const nextCursor = hasMore
      ? Buffer.from(data[data.length - 1].createdAt.toISOString()).toString('base64')
      : null;

    return {
      data: data.reverse().map(toPublicChannelMessage),
      meta: { cursor: nextCursor, hasMore },
    };
  }

  async sendChannelMessage(
    channelId: string,
    userId: string,
    dto: SendChannelMessageDto,
    viewerRole?: UserRole | null,
  ) {
    const channel = await this.getChannelWithCommunity(channelId);
    await this.assertChannelAccess(channel, userId, viewerRole);

    const key = `channel:msg:rate:${channelId}:${userId}`;
    const set = await this.redis.set(key, '1', 'EX', 3, 'NX');
    if (set !== 'OK') {
      throw new ForbiddenException('Slow down — wait before sending another message');
    }

    const msg = await this.messageRepository.save(
      this.messageRepository.create({
        channelId,
        userId,
        body: dto.body.trim(),
        parentId: dto.parentId ?? null,
      }),
    );

    const full = await this.messageRepository.findOne({
      where: { id: msg.id },
      relations: ['user'],
    });

    const publicMsg = toPublicChannelMessage(full!);
    this.eventEmitter.emit('channel.message', { channelId, message: publicMsg });
    return publicMsg;
  }

  private async getChannelWithCommunity(channelId: string): Promise<Channel & { community: Community }> {
    const channel = await this.channelRepository.findOne({
      where: { id: channelId },
      relations: ['community'],
    });
    if (!channel) throw new NotFoundException('Channel not found');
    return channel as Channel & { community: Community };
  }

  private async getOwnedChannel(creatorId: string, channelId: string): Promise<Channel> {
    const channel = await this.getChannelWithCommunity(channelId);
    if (channel.community.creatorId !== creatorId) {
      throw new ForbiddenException();
    }
    return channel;
  }

  private async loadInviteMemberChannelIds(
    viewerId: string,
    channelIds: string[],
  ): Promise<Set<string>> {
    const unique = [...new Set(channelIds.filter(Boolean))];
    if (unique.length === 0) return new Set();
    const rows = await this.memberRepository.find({
      where: { userId: viewerId, channelId: In(unique) },
      select: ['channelId'],
    });
    return new Set(rows.map((r) => r.channelId));
  }

  private async assertChannelAccess(
    channel: Channel & { community: Community },
    viewerId: string | null | undefined,
    viewerRole?: UserRole | null,
  ) {
    const creatorId = channel.community.creatorId;
    const isOwner = viewerId === creatorId;
    const isAdmin = viewerRole === UserRole.ADMIN;

    const isMember =
      channel.type === ChannelType.INVITE && viewerId
        ? !!(await this.memberRepository.findOne({
            where: { channelId: channel.id, userId: viewerId },
          }))
        : false;

    const access = await this.entitlementsService.checkChannelAccess(
      viewerId,
      {
        type: channel.type,
        requiredTierId: channel.requiredTierId,
        creatorId,
        isMember,
      },
      { isOwner, isAdmin },
    );

    if (!access.allowed) {
      throw new ForbiddenException('You do not have access to this channel');
    }
  }
}
