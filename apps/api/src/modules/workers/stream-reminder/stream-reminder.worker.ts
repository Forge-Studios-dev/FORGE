import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Between, In, IsNull, Repository } from 'typeorm';
import { Stream, StreamStatus } from '../../streaming/entities/stream.entity';
import { StreamRsvp } from '../../streaming/entities/stream-rsvp.entity';
import { MuxLiveSyncService } from '../../streaming/mux-live-sync.service';
import { STREAM_REMINDER_QUEUE } from './stream-reminder.constants';

@Processor(STREAM_REMINDER_QUEUE)
export class StreamReminderWorker extends WorkerHost {
  private readonly logger = new Logger(StreamReminderWorker.name);

  constructor(
    @InjectRepository(Stream)
    private readonly streamRepository: Repository<Stream>,
    @InjectRepository(StreamRsvp)
    private readonly rsvpRepository: Repository<StreamRsvp>,
    private readonly eventEmitter: EventEmitter2,
    private readonly muxLiveSyncService: MuxLiveSyncService,
  ) {
    super();
  }

  async process(_job: Job): Promise<void> {
    if (await this.muxLiveSyncService.isPlatformDormant()) {
      this.logger.debug('Stream reminder scan skipped — platform dormant');
      return;
    }

    const now = new Date();
    const in15 = new Date(now.getTime() + 15 * 60_000);

    const upcoming = await this.streamRepository.find({
      where: {
        status: StreamStatus.IDLE,
        endedAt: IsNull(),
        scheduledAt: Between(now, in15),
        reminderSentAt: IsNull(),
      },
      relations: ['user'],
      take: 50,
    });

    const streamIds = upcoming.map((s) => s.id);
    const allRsvps =
      streamIds.length > 0
        ? await this.rsvpRepository.find({
            where: { streamId: In(streamIds) },
            select: ['streamId', 'userId'],
          })
        : [];

    const rsvpsByStream = new Map<string, string[]>();
    for (const rsvp of allRsvps) {
      const list = rsvpsByStream.get(rsvp.streamId) ?? [];
      list.push(rsvp.userId);
      rsvpsByStream.set(rsvp.streamId, list);
    }

    for (const stream of upcoming) {
      this.eventEmitter.emit('stream.reminder', {
        streamId: stream.id,
        userId: stream.userId,
        title: stream.title,
        scheduledAt: stream.scheduledAt,
        creatorName: stream.user?.displayName,
        rsvpUserIds: rsvpsByStream.get(stream.id) ?? [],
      });

      await this.streamRepository.update(stream.id, { reminderSentAt: now });
    }

    this.logger.debug(`Stream reminder scan: ${upcoming.length} upcoming within 15m`);
  }
}
