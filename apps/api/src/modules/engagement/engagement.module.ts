import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EngagementController } from './engagement.controller';
import { EngagementService } from './engagement.service';
import { Like } from './entities/like.entity';
import { Comment } from './entities/comment.entity';
import { Follow } from './entities/follow.entity';
import { Video } from '../content/entities/video.entity';
import { User } from '../users/entities/user.entity';
import { EntitlementsModule } from '../entitlements/entitlements.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Like, Comment, Follow, Video, User]),
    forwardRef(() => EntitlementsModule),
  ],
  controllers: [EngagementController],
  providers: [EngagementService],
  exports: [EngagementService],
})
export class EngagementModule {}
