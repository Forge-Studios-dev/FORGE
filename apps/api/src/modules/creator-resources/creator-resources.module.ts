import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreatorResource } from './entities/creator-resource.entity';
import { CreatorResourcesService } from './creator-resources.service';
import { CreatorResourcesController } from './creator-resources.controller';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { EngagementModule } from '../engagement/engagement.module';
import { CreatorApprovedGuard } from '../../common/guards/creator-approved.guard';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CreatorResource]),
    forwardRef(() => EntitlementsModule),
    forwardRef(() => EngagementModule),
    forwardRef(() => UsersModule),
  ],
  controllers: [CreatorResourcesController],
  providers: [CreatorResourcesService, CreatorApprovedGuard],
  exports: [CreatorResourcesService],
})
export class CreatorResourcesModule {}
