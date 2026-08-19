import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlaylistsController } from './playlists.controller';
import { PlaylistsService } from './playlists.service';
import { Playlist } from './entities/playlist.entity';
import { PlaylistVideo } from './entities/playlist-video.entity';
import { Video } from '../content/entities/video.entity';
import { Like } from '../engagement/entities/like.entity';
import { EngagementModule } from '../engagement/engagement.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Playlist, PlaylistVideo, Video, Like]),
    EngagementModule,
    // EntitlementsModule -> UsersModule -> PlaylistsModule already forms a
    // cycle (UsersModule imports PlaylistsModule plainly) -- forwardRef here
    // is the side that breaks it, matching content.module.ts's same edge.
    forwardRef(() => EntitlementsModule),
  ],
  controllers: [PlaylistsController],
  providers: [PlaylistsService],
  exports: [PlaylistsService],
})
export class PlaylistsModule {}
