import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Stream, StreamStatus } from './entities/stream.entity';
import { CommunityRoom, CommunityRoomType } from '../communities/entities/community-room.entity';

export interface BreakoutSession {
  rooms: Array<{ roomId: string; name: string; maxParticipants: number }>;
  durationMinutes: number;
  endsAt: string;
  streamId: string;
  communityId: string;
}

@Injectable()
export class StreamBreakoutService {
  static readonly MAX_BREAKOUT_ROOMS = 20;
  static readonly MAX_DURATION_MINUTES = 120;

  constructor(
    @InjectRepository(Stream)
    private readonly streamRepository: Repository<Stream>,
    @InjectRepository(CommunityRoom)
    private readonly roomRepository: Repository<CommunityRoom>,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createBreakoutRooms(
    creatorId: string,
    streamId: string,
    input: {
      roomCount: number;
      durationMinutes: number;
      maxParticipantsPerRoom?: number;
      namingPrefix?: string;
    },
  ): Promise<BreakoutSession> {
    const stream = await this.streamRepository.findOne({ where: { id: streamId } });
    if (!stream) throw new NotFoundException('Stream not found');
    if (stream.userId !== creatorId) throw new ForbiddenException('Only stream creator can create breakout rooms');
    if (stream.status !== StreamStatus.LIVE) throw new BadRequestException('Stream must be live to create breakout rooms');
    if (!stream.communityId) throw new BadRequestException('Stream must be community-linked for breakout rooms');

    const { roomCount, durationMinutes, maxParticipantsPerRoom, namingPrefix } = input;
    if (roomCount < 2 || roomCount > StreamBreakoutService.MAX_BREAKOUT_ROOMS) {
      throw new BadRequestException(`Room count must be 2–${StreamBreakoutService.MAX_BREAKOUT_ROOMS}`);
    }
    if (durationMinutes < 1 || durationMinutes > StreamBreakoutService.MAX_DURATION_MINUTES) {
      throw new BadRequestException(`Duration must be 1–${StreamBreakoutService.MAX_DURATION_MINUTES} minutes`);
    }

    const prefix = (namingPrefix ?? 'Breakout').slice(0, 30);
    const endsAt = new Date(Date.now() + durationMinutes * 60 * 1000);

    const createdRooms: CommunityRoom[] = [];
    for (let i = 1; i <= roomCount; i++) {
      const name = `${prefix} ${i}`;
      const slug = `breakout-${streamId.slice(0, 8)}-${i}-${Date.now()}`;
      const room = await this.roomRepository.save(
        this.roomRepository.create({
          communityId: stream.communityId,
          name,
          slug,
          roomType: CommunityRoomType.BREAKOUT,
          maxParticipants: maxParticipantsPerRoom ?? 10,
          isActive: true,
          description: `Breakout room for live stream`,
          settings: { streamId, endsAt: endsAt.toISOString() },
        }),
      );
      createdRooms.push(room);
    }

    const session: BreakoutSession = {
      streamId,
      communityId: stream.communityId,
      rooms: createdRooms.map((r) => ({
        roomId: r.id,
        name: r.name,
        maxParticipants: r.maxParticipants ?? 10,
      })),
      durationMinutes,
      endsAt: endsAt.toISOString(),
    };

    this.eventEmitter.emit('stream.breakout.started', session);
    return session;
  }

  async assignParticipants(
    creatorId: string,
    streamId: string,
    communityId: string,
    roomIds: string[],
  ): Promise<{ assignments: Array<{ userId: string; roomId: string }> }> {
    const stream = await this.streamRepository.findOne({ where: { id: streamId, userId: creatorId } });
    if (!stream) throw new NotFoundException('Stream not found or not owned by you');

    // Get current viewers from community member list
    const members = await this.dataSource.query<{ user_id: string }[]>(
      `SELECT user_id FROM community_members WHERE community_id = $1 AND left_at IS NULL LIMIT 500`,
      [communityId],
    );

    if (!members.length) return { assignments: [] };

    const assignments: Array<{ userId: string; roomId: string }> = [];
    let roomIndex = 0;
    for (const member of members) {
      if (roomIndex >= roomIds.length) roomIndex = 0;
      assignments.push({ userId: member.user_id, roomId: roomIds[roomIndex++] });
    }

    this.eventEmitter.emit('stream.breakout.assigned', { streamId, communityId, assignments });
    return { assignments };
  }

  async endBreakoutRooms(creatorId: string, streamId: string, roomIds: string[]): Promise<void> {
    const stream = await this.streamRepository.findOne({ where: { id: streamId, userId: creatorId } });
    if (!stream) throw new NotFoundException('Stream not found');

    if (roomIds.length > 0) {
      await this.roomRepository.update(roomIds, { isActive: false });
    }
    this.eventEmitter.emit('stream.breakout.ended', { streamId, communityId: stream.communityId });
  }

  async listBreakoutRooms(streamId: string, communityId: string) {
    const rooms = await this.dataSource.query<CommunityRoom[]>(
      `SELECT * FROM community_rooms
       WHERE community_id = $1
         AND room_type = 'breakout'
         AND is_active = true
         AND settings->>'streamId' = $2
       ORDER BY created_at DESC`,
      [communityId, streamId],
    );
    return { data: rooms };
  }
}
