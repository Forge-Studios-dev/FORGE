import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ChannelPointRedemption,
  ChannelPointReward,
  ChannelPointsBalance,
} from './entities/channel-points.entity';
import { ChannelPointsService } from './channel-points.service';
import { ChannelPointsController } from './channel-points.controller';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChannelPointsBalance,
      ChannelPointReward,
      ChannelPointRedemption,
    ]),
  ],
  providers: [ChannelPointsService, CreatorApprovedGuard],
  controllers: [ChannelPointsController],
  exports: [ChannelPointsService],
})
export class ChannelPointsModule {}
