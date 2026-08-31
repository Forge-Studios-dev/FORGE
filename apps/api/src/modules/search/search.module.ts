import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { Video } from '../content/entities/video.entity';
import { User } from '../users/entities/user.entity';
import { Playlist } from '../playlists/entities/playlist.entity';
import { ContentModule } from '../content/content.module';
import { EngagementModule } from '../engagement/engagement.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Video, User, Playlist]),
    forwardRef(() => ContentModule),
    forwardRef(() => EngagementModule),
  ],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
