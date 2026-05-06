import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StreamingController } from './streaming.controller';
import { StreamingService } from './streaming.service';
import { Stream } from './entities/stream.entity';
import { UsersModule } from '../users/users.module';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';
import { Video } from '../content/entities/video.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Stream, Video]), UsersModule],
  controllers: [StreamingController],
  providers: [StreamingService, CreatorApprovedGuard],
  exports: [StreamingService],
})
export class StreamingModule {}
