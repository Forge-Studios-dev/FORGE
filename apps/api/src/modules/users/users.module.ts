import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { EmailVerifiedGuard } from '../../common/guards/email-verified.guard';
import { User } from './entities/user.entity';
import { Video } from '../content/entities/video.entity';
import { WatchHistory } from '../engagement/entities/watch-history.entity';
import { PlaylistsModule } from '../playlists/playlists.module';
import { ContentModule } from '../content/content.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Video, WatchHistory]),
    PlaylistsModule,
    forwardRef(() => ContentModule),
  ],
  controllers: [UsersController],
  providers: [UsersService, EmailVerifiedGuard],
  exports: [UsersService, EmailVerifiedGuard],
})
export class UsersModule {}
