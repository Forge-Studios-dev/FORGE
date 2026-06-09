import { Module } from '@nestjs/common';
import { LiveBroadcastService } from './live-broadcast.service';
import { LiveBroadcastController } from './live-broadcast.controller';
import { StreamingModule } from '../streaming/streaming.module';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';

@Module({
  imports: [StreamingModule],
  controllers: [LiveBroadcastController],
  providers: [LiveBroadcastService, CreatorApprovedGuard],
  exports: [LiveBroadcastService],
})
export class LiveBroadcastModule {}
