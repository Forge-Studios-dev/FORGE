import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { Repository, IsNull } from 'typeorm';
import { DeviceToken } from './entities/device-token.entity';
import { PUSH_DISPATCH_QUEUE, PushDispatchJob } from './push-dispatch.constants';
import { FirebaseService } from '../firebase/firebase.service';

@Injectable()
export class PushDispatchService {
  private readonly logger = new Logger(PushDispatchService.name);

  constructor(
    @InjectRepository(DeviceToken)
    private readonly deviceTokenRepository: Repository<DeviceToken>,
    @InjectQueue(PUSH_DISPATCH_QUEUE)
    private readonly pushQueue: Queue<PushDispatchJob>,
    private readonly firebase: FirebaseService,
  ) {}

  async enqueueForUser(
    userId: string,
    payload: { title: string; body: string; data?: Record<string, string> },
  ) {
    if (!this.firebase.isFcmEnabled()) return;
    const count = await this.deviceTokenRepository.count({
      where: { userId, revokedAt: IsNull() },
    });
    if (count === 0) return;
    await this.pushQueue.add('send', { userId, ...payload }, { removeOnComplete: true });
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
}
