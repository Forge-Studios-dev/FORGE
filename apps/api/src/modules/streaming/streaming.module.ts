import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StreamingController } from './streaming.controller';
import { StreamingService } from './streaming.service';
import { Stream } from './entities/stream.entity';
import { UsersModule } from '../users/users.module';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt.guard';
import { Video } from '../content/entities/video.entity';
import { ContentModule } from '../content/content.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';

import { StreamViewerService } from './stream-viewer.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Stream, Video]),
    UsersModule,
    ContentModule,
    EntitlementsModule,
  ],
  controllers: [StreamingController],
  providers: [StreamingService, StreamViewerService, CreatorApprovedGuard, OptionalJwtAuthGuard],
  exports: [StreamingService, StreamViewerService],
})
export class StreamingModule {}
