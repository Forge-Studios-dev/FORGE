import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Between, In, IsNull, Repository } from 'typeorm';
import { Stream, StreamStatus } from '../../streaming/entities/stream.entity';
import { StreamRsvp } from '../../streaming/entities/stream-rsvp.entity';
import { MuxLiveSyncService } from '../../streaming/mux-live-sync.service';
import { STREAM_REMINDER_QUEUE, StreamReminderJob } from './stream-reminder.constants';

@Processor(STREAM_REMINDER_QUEUE, { concurrency: 1 })
export class StreamReminderWorker extends WorkerHost {
  private readonly logger = new Logger(StreamReminderWorker.name);
  private static readonly MAX_RSVPS_PER_SCAN = 2000;

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

  async process(job: Job<StreamReminderJob>): Promise<void> {
    if (job.data?.streamId) {
      await this.remindStream(job.data.streamId);
      return;
    }

    if (await this.muxLiveSyncService.isPlatformDormant()) {
      this.logger.debug('Stream reminder backup scan skipped — platform dormant');
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

    await this.emitReminders(upcoming, now);
    this.logger.debug(`Stream reminder backup scan: ${upcoming.length} upcoming within 15m`);
  }

  private async remindStream(streamId: string): Promise<void> {
    const stream = await this.streamRepository.findOne({
      where: {
        id: streamId,
        status: StreamStatus.IDLE,
        endedAt: IsNull(),
        reminderSentAt: IsNull(),
      },
      relations: ['user'],
    });
    if (!stream?.scheduledAt) return;

    const now = Date.now();
    const leadMs = 15 * 60_000;
    // Fire if we're within 20m before start (covers delayed-job jitter).
    if (stream.scheduledAt.getTime() - now > leadMs + 5 * 60_000) return;
    if (stream.scheduledAt.getTime() < now - 5 * 60_000) return;

    await this.emitReminders([stream], new Date());
  }

  private async emitReminders(streams: Stream[], now: Date): Promise<void> {
    if (!streams.length) return;

    const streamIds = streams.map((s) => s.id);
    const allRsvps = await this.rsvpRepository.find({
      where: { streamId: In(streamIds) },
      select: ['streamId', 'userId'],
      take: StreamReminderWorker.MAX_RSVPS_PER_SCAN,
    });

    const rsvpsByStream = new Map<string, string[]>();
    for (const rsvp of allRsvps) {
      const list = rsvpsByStream.get(rsvp.streamId) ?? [];
      list.push(rsvp.userId);
      rsvpsByStream.set(rsvp.streamId, list);
    }

    for (const stream of streams) {
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
  }
}
