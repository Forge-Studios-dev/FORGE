import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreatorResource } from './entities/creator-resource.entity';
import { CreatorResourcesService } from './creator-resources.service';
import { CreatorResourcesController } from './creator-resources.controller';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';

@Module({
  imports: [TypeOrmModule.forFeature([CreatorResource]), EntitlementsModule],
  controllers: [CreatorResourcesController],
  providers: [CreatorResourcesService, CreatorApprovedGuard],
  exports: [CreatorResourcesService],
})
export class CreatorResourcesModule {}
