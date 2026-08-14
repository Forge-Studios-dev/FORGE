import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Repository, In, IsNull } from 'typeorm';
import { isCategoryMuted, type NotificationCategory } from '@forge/shared-types';
import { DeviceToken } from './entities/device-token.entity';
import { PUSH_DISPATCH_QUEUE, PushDispatchJob } from './push-dispatch.constants';
import { FirebaseService } from '../firebase/firebase.service';
import { User } from '../users/entities/user.entity';

export type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
  /** Required so a muted category can be filtered before a push ever reaches FCM. */
  category: NotificationCategory;
};

type PushJob = {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  category: NotificationCategory;
};

@Injectable()
export class PushDispatchService {
  private static readonly LOOKUP_CHUNK = 500;
  private static readonly ENQUEUE_CHUNK = 500;

  constructor(
    @InjectRepository(DeviceToken)
    private readonly deviceTokenRepository: Repository<DeviceToken>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
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
  async enqueueMany(jobs: PushJob[]): Promise<void> {
    if (!this.firebase.isFcmEnabled() || !jobs.length) return;

    const notMuted = await this.filterMutedJobs(jobs);
    if (!notMuted.length) return;

    const uniqueUserIds = [...new Set(notMuted.map((j) => j.userId))];
    const usersWithTokens = await this.loadUsersWithActiveTokens(uniqueUserIds);
    if (!usersWithTokens.size) return;

    const eligible = notMuted.filter((j) => usersWithTokens.has(j.userId));
    for (let i = 0; i < eligible.length; i += PushDispatchService.ENQUEUE_CHUNK) {
      const chunk = eligible.slice(i, i + PushDispatchService.ENQUEUE_CHUNK);
      await this.pushQueue.addBulk(
        chunk.map(({ userId, title, body, data }) => ({
          name: 'send',
          data: { userId, title, body, data },
          opts: { removeOnComplete: true },
        })),
      );
    }
  }

  /** Same choke point as NotificationsService — skips a token lookup for muted users too. */
  private async filterMutedJobs(jobs: PushJob[]): Promise<PushJob[]> {
    const userIds = [...new Set(jobs.map((j) => j.userId).filter(Boolean))];
    if (!userIds.length) return [];
    const prefRows = await this.userRepository.find({
      where: { id: In(userIds) },
      select: { id: true, notificationPreferences: true },
    });
    const prefsById = new Map(prefRows.map((r) => [r.id, r.notificationPreferences]));
    return jobs.filter((job) => !isCategoryMuted(prefsById.get(job.userId), job.category));
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
