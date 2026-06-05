import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { FeatureFlagsService } from './feature-flags.service';

@Module({
  controllers: [PlatformController],
  providers: [FeatureFlagsService],
  exports: [FeatureFlagsService],
})
export class PlatformModule {}
