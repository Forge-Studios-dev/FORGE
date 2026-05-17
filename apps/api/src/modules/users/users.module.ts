import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { Video } from '../content/entities/video.entity';
import { WatchHistory } from '../engagement/entities/watch-history.entity';
import { PlaylistsModule } from '../playlists/playlists.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, Video, WatchHistory]), PlaylistsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
