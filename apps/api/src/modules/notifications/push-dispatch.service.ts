import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Repository, IsNull } from 'typeorm';
import { DeviceToken } from './entities/device-token.entity';
import { PUSH_DISPATCH_QUEUE, PushDispatchJob } from './push-dispatch.constants';
import { FirebaseService } from '../firebase/firebase.service';

export type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

@Injectable()
export class PushDispatchService {
  private static readonly LOOKUP_CHUNK = 500;
  private static readonly ENQUEUE_CHUNK = 500;

  constructor(
    @InjectRepository(DeviceToken)
    private readonly deviceTokenRepository: Repository<DeviceToken>,
    @InjectQueue(PUSH_DISPATCH_QUEUE)
    private readonly pushQueue: Queue<PushDispatchJob>,
    private readonly firebase: FirebaseService,
  ) {}

  async enqueueForUser(userId: string, payload: PushPayload) {
    await this.enqueueForUsers([userId], payload);
  }

  /** Same push payload for many users — one token lookup query per chunk. */
  async enqueueForUsers(userIds: string[], payload: PushPayload): Promise<void> {
    const unique = [...new Set(userIds.filter(Boolean))];
    if (!unique.length) return;
    await this.enqueueMany(unique.map((userId) => ({ userId, ...payload })));
  }

  /** Varied per-user payloads — still batched token lookup + BullMQ addBulk. */
  async enqueueMany(
    jobs: Array<{ userId: string; title: string; body: string; data?: Record<string, string> }>,
  ): Promise<void> {
    if (!this.firebase.isFcmEnabled() || !jobs.length) return;

    const uniqueUserIds = [...new Set(jobs.map((j) => j.userId).filter(Boolean))];
    const usersWithTokens = await this.loadUsersWithActiveTokens(uniqueUserIds);
    if (!usersWithTokens.size) return;

    const eligible = jobs.filter((j) => usersWithTokens.has(j.userId));
    for (let i = 0; i < eligible.length; i += PushDispatchService.ENQUEUE_CHUNK) {
      const chunk = eligible.slice(i, i + PushDispatchService.ENQUEUE_CHUNK);
      await this.pushQueue.addBulk(
        chunk.map((job) => ({
          name: 'send',
          data: job,
          opts: { removeOnComplete: true },
        })),
      );
    }
  }

  async revokeAllForUser(userId: string) {
    await this.deviceTokenRepository.update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  async revokeToken(userId: string, fcmToken: string) {
    await this.deviceTokenRepository.update(
      { userId, fcmToken, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  private async loadUsersWithActiveTokens(userIds: string[]): Promise<Set<string>> {
    const result = new Set<string>();
    for (let i = 0; i < userIds.length; i += PushDispatchService.LOOKUP_CHUNK) {
      const chunk = userIds.slice(i, i + PushDispatchService.LOOKUP_CHUNK);
      const rows = await this.deviceTokenRepository
        .createQueryBuilder('dt')
        .select('DISTINCT dt.user_id', 'userId')
        .where('dt.user_id IN (:...userIds)', { userIds: chunk })
        .andWhere('dt.revoked_at IS NULL')
        .getRawMany<{ userId: string }>();
      for (const row of rows) {
        if (row.userId) result.add(row.userId);
      }
    }
    return result;
  }
}
