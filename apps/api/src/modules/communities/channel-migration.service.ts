import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChannelRoomMapping } from './entities/channel-room-mapping.entity';
import { Channel } from './entities/channel.entity';
import { CommunityRoom, CommunityRoomType } from './entities/community-room.entity';
import { ChannelMessage } from './entities/channel-message.entity';
import { CommunityRoomMessage } from './entities/community-room-message.entity';

@Injectable()
export class ChannelMigrationService {
  constructor(
    @InjectRepository(ChannelRoomMapping)
    private readonly mappingRepository: Repository<ChannelRoomMapping>,
    @InjectRepository(Channel)
    private readonly channelRepository: Repository<Channel>,
    @InjectRepository(CommunityRoom)
    private readonly roomRepository: Repository<CommunityRoom>,
    @InjectRepository(ChannelMessage)
    private readonly channelMessageRepository: Repository<ChannelMessage>,
    @InjectRepository(CommunityRoomMessage)
    private readonly roomMessageRepository: Repository<CommunityRoomMessage>,
  ) {}

  async resolveRoomIdForChannel(channelId: string): Promise<string | null> {
    const row = await this.mappingRepository.findOne({ where: { channelId } });
    if (row) return row.roomId;
    const channel = await this.channelRepository.findOne({ where: { id: channelId } });
    if (!channel) return null;
    try {
      return await this.ensureChannelMapped(channelId);
    } catch {
      return null;
    }
  }

  async resolveChannelIdForRoom(roomId: string): Promise<string | null> {
    const row = await this.mappingRepository.findOne({ where: { roomId } });
    return row?.channelId ?? null;
  }

  /** Idempotent backfill: one text room per channel + message copy. */
  async ensureChannelMapped(channelId: string): Promise<string> {
    const existing = await this.mappingRepository.findOne({ where: { channelId } });
    if (existing) return existing.roomId;

    const channel = await this.channelRepository.findOne({ where: { id: channelId } });
    if (!channel) throw new NotFoundException(`Channel ${channelId} not found`);

    let room = await this.roomRepository.findOne({
      where: { communityId: channel.communityId, slug: channel.slug },
    });
    if (!room) {
      room = await this.roomRepository.save(
        this.roomRepository.create({
          communityId: channel.communityId,
          name: channel.name,
          slug: channel.slug,
          roomType: CommunityRoomType.TEXT,
          categoryId: channel.categoryId,
          sortOrder: channel.sortOrder,
          settings: channel.requiredTierId
            ? { requiredTierId: channel.requiredTierId, migratedFromChannelId: channelId }
            : { migratedFromChannelId: channelId },
        }),
      );
    }

    await this.mappingRepository.save(
      this.mappingRepository.create({ channelId, roomId: room.id }),
    );

    const messages = await this.channelMessageRepository.find({
      where: { channelId },
      order: { createdAt: 'ASC' },
    });
    if (messages.length === 0) return room.id;

    const idMap = new Map<string, string>();
    for (const msg of messages) {
      const saved = await this.roomMessageRepository.save(
        this.roomMessageRepository.create({
          roomId: room.id,
          userId: msg.userId,
          body: msg.body,
          parentMessageId: msg.parentId ? (idMap.get(msg.parentId) ?? null) : null,
          deletedAt: msg.deletedAt,
          createdAt: msg.createdAt,
        }),
      );
      idMap.set(msg.id, saved.id);
    }

    return room.id;
  }
}
