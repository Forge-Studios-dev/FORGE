import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { UsernameHistory } from './entities/username-history.entity';
import { Video } from '../content/entities/video.entity';
import { WatchHistory } from '../engagement/entities/watch-history.entity';
import { PlaylistsModule } from '../playlists/playlists.module';
import { ContentModule } from '../content/content.module';
import { EngagementModule } from '../engagement/engagement.module';
import { AdminModule } from '../admin/admin.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UsernameHistory, Video, WatchHistory]),
    PlaylistsModule,
    forwardRef(() => ContentModule),
    EngagementModule,
    forwardRef(() => AdminModule),
    forwardRef(() => AuthModule),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
