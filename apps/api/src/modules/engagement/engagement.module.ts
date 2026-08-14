import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { EngagementController } from './engagement.controller';
import { EngagementService } from './engagement.service';
import { EngagementReconciliationService } from './engagement-reconciliation.service';
import { EngagementReconciliationScheduler } from './engagement-reconciliation.scheduler';
import { Like } from './entities/like.entity';
import { Comment } from './entities/comment.entity';
import { CommentLike } from './entities/comment-like.entity';
import { Follow } from './entities/follow.entity';
import { UserBlock } from './entities/user-block.entity';
import { Share } from './entities/share.entity';
import { Video } from '../content/entities/video.entity';
import { User } from '../users/entities/user.entity';
import { ENGAGEMENT_RECONCILIATION_QUEUE } from './engagement-reconciliation.constants';
import { AiModerationService } from '../communities/ai-moderation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Like, Comment, CommentLike, Follow, UserBlock, Share, Video, User]),
    BullModule.registerQueue({
      name: ENGAGEMENT_RECONCILIATION_QUEUE,
      defaultJobOptions: {
        attempts: 2,
        removeOnComplete: { age: 7 * 86400, count: 14 },
        removeOnFail: { age: 7 * 86400, count: 50 },
      },
    }),
  ],
  controllers: [EngagementController],
  providers: [
    EngagementService,
    EngagementReconciliationService,
    EngagementReconciliationScheduler,
    AiModerationService,
  ],
  exports: [EngagementService, EngagementReconciliationService],
})
export class EngagementModule {}
