import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAuditLog } from './entities/admin-audit-log.entity';
import { AdminAuditLogService } from './admin-audit-log.service';
import { User } from '../../modules/users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AdminAuditLog, User])],
  providers: [AdminAuditLogService],
  exports: [AdminAuditLogService],
})
export class AdminAuditLogModule {}
