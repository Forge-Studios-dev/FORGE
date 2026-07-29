import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Repository, IsNull } from 'typeorm';
import { DeviceToken } from '../../notifications/entities/device-token.entity';
import { PUSH_DISPATCH_QUEUE, PushDispatchJob } from '../../notifications/push-dispatch.constants';
import { FirebaseService } from '../../firebase/firebase.service';

const BATCH_SIZE = 500;

@Processor(PUSH_DISPATCH_QUEUE, { concurrency: 3 })
export class PushDispatchWorker extends WorkerHost {
  private readonly logger = new Logger(PushDispatchWorker.name);

  constructor(
    @InjectRepository(DeviceToken)
    private readonly deviceTokenRepository: Repository<DeviceToken>,
    private readonly firebase: FirebaseService,
  ) {
    super();
  }

  async process(job: Job<PushDispatchJob>): Promise<void> {
    const messaging = this.firebase.getMessaging();
    if (!messaging) {
      this.logger.warn('FCM not configured — skipping push job');
      return;
    }

    const tokens = await this.deviceTokenRepository.find({
      where: { userId: job.data.userId, revokedAt: IsNull() },
      select: ['id', 'fcmToken'],
    });
    if (tokens.length === 0) return;

    const fcmTokens = tokens.map((t) => t.fcmToken);
    for (let i = 0; i < fcmTokens.length; i += BATCH_SIZE) {
      const slice = fcmTokens.slice(i, i + BATCH_SIZE);
      try {
        const res = await messaging.sendEachForMulticast({
          tokens: slice,
          notification: { title: job.data.title, body: job.data.body },
          data: job.data.data ?? {},
        });
        res.responses.forEach((r, idx) => {
          if (!r.success) {
            const code = r.error?.code;
            if (
              code === 'messaging/registration-token-not-registered' ||
              code === 'messaging/invalid-registration-token'
            ) {
              void this.deviceTokenRepository.update(
                { fcmToken: slice[idx]! },
                { revokedAt: new Date() },
              );
            }
          }
        });
      } catch (e) {
        this.logger.error(`FCM batch failed: ${(e as Error).message}`);
        throw e;
      }
    }
  }
}
