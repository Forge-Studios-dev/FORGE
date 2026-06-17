import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccessSessionAudit } from './entities/access-session-audit.entity';
import { AccessSessionsService } from './access-sessions.service';
import { AccessSessionsController } from './access-sessions.controller';
import { EntitlementsModule } from '../entitlements/entitlements.module';

@Module({
  imports: [TypeOrmModule.forFeature([AccessSessionAudit]), EntitlementsModule],
  controllers: [AccessSessionsController],
  providers: [AccessSessionsService],
  exports: [AccessSessionsService],
})
export class AccessSessionsModule {}
