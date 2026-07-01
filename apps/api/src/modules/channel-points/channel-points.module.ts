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
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChannelPointsBalance,
      ChannelPointReward,
      ChannelPointRedemption,
    ]),
    UsersModule,
  ],
  providers: [ChannelPointsService, CreatorApprovedGuard],
  controllers: [ChannelPointsController],
  exports: [ChannelPointsService],
})
export class ChannelPointsModule {}
