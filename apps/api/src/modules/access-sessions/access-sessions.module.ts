import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessSessionAudit } from './entities/access-session-audit.entity';
import { AccessSessionsService } from './access-sessions.service';
import { AccessSessionsController } from './access-sessions.controller';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { EngagementModule } from '../engagement/engagement.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AccessSessionAudit]),
    forwardRef(() => EntitlementsModule),
    // Auth→Analytics→Communities→AccessSessions→Engagement→…→Auth cycle;
    // plain EngagementModule is undefined under that load order in prod.
    forwardRef(() => EngagementModule),
  ],
  controllers: [AccessSessionsController],
  providers: [AccessSessionsService],
  exports: [AccessSessionsService],
})
export class AccessSessionsModule {}
