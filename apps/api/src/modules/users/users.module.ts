import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { Video } from '../content/entities/video.entity';
import { WatchHistory } from '../engagement/entities/watch-history.entity';
import { PlaylistsModule } from '../playlists/playlists.module';
import { ContentModule } from '../content/content.module';
import { EngagementModule } from '../engagement/engagement.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Video, WatchHistory]),
    PlaylistsModule,
    forwardRef(() => ContentModule),
    EngagementModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
