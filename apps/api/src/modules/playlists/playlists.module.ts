import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlaylistsController } from './playlists.controller';
import { PlaylistsService } from './playlists.service';
import { Playlist } from './entities/playlist.entity';
import { PlaylistVideo } from './entities/playlist-video.entity';
import { Video } from '../content/entities/video.entity';
import { Like } from '../engagement/entities/like.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Playlist, PlaylistVideo, Video, Like])],
  controllers: [PlaylistsController],
  providers: [PlaylistsService],
  exports: [PlaylistsService],
})
export class PlaylistsModule {}
