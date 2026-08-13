import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { CopyrightController } from './copyright.controller';
import { CopyrightService } from './copyright.service';
import { CopyrightNotice } from './entities/copyright-notice.entity';
import { CopyrightCounterNotice } from './entities/copyright-counter-notice.entity';
import { Video } from '../content/entities/video.entity';
import { ContentModule } from '../content/content.module';
import { AccountStrikesModule } from '../account-strikes/account-strikes.module';
import { CopyrightReinstatementScheduler } from './copyright-reinstatement.scheduler';
import { COPYRIGHT_REINSTATEMENT_QUEUE } from './copyright-reinstatement.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([CopyrightNotice, CopyrightCounterNotice, Video]),
    ContentModule,
    AccountStrikesModule,
    BullModule.registerQueue({
      name: COPYRIGHT_REINSTATEMENT_QUEUE,
      defaultJobOptions: {
        attempts: 2,
        removeOnComplete: { age: 7 * 86400, count: 50 },
        removeOnFail: { age: 7 * 86400, count: 50 },
      },
    }),
  ],
  controllers: [CopyrightController],
  providers: [CopyrightService, CopyrightReinstatementScheduler],
  exports: [CopyrightService],
})
export class CopyrightModule {}
