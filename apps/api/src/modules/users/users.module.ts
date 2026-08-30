import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { UsernameHistory } from './entities/username-history.entity';
import { Video } from '../content/entities/video.entity';
import { WatchHistory } from '../engagement/entities/watch-history.entity';
import { Comment } from '../engagement/entities/comment.entity';
import { CommunityPost } from '../communities/entities/community-post.entity';
import { AccountStrike } from '../account-strikes/entities/account-strike.entity';
import { PlaylistsModule } from '../playlists/playlists.module';
import { ContentModule } from '../content/content.module';
import { EngagementModule } from '../engagement/engagement.module';
import { AdminModule } from '../admin/admin.module';
import { AuthModule } from '../auth/auth.module';
import { AccountPurgeService } from './account-purge.service';
import { AccountPurgeScheduler } from './account-purge.scheduler';
import { ACCOUNT_PURGE_QUEUE } from './account-purge.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UsernameHistory,
      Video,
      WatchHistory,
      Comment,
      CommunityPost,
      AccountStrike,
    ]),
    PlaylistsModule,
    forwardRef(() => ContentModule),
    forwardRef(() => EngagementModule),
    forwardRef(() => AdminModule),
    forwardRef(() => AuthModule),
    BullModule.registerQueue({
      name: ACCOUNT_PURGE_QUEUE,
      defaultJobOptions: {
        attempts: 2,
        removeOnComplete: { age: 7 * 86400, count: 30 },
        removeOnFail: { age: 7 * 86400, count: 30 },
      },
    }),
  ],
  controllers: [UsersController],
  providers: [UsersService, AccountPurgeService, AccountPurgeScheduler],
  exports: [UsersService, AccountPurgeService],
})
export class UsersModule {}
