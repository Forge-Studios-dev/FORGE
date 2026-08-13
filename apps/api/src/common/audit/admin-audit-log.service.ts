import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminAuditLog } from './entities/admin-audit-log.entity';
import { clampLimit, clampPage } from '../utils/pagination.util';

export type AdminAuditLogEntry = {
  actorId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
};

@Injectable()
export class AdminAuditLogService {
  private readonly logger = new Logger(AdminAuditLogService.name);

  constructor(
    @InjectRepository(AdminAuditLog)
    private readonly repository: Repository<AdminAuditLog>,
  ) {}

  /**
   * Best-effort: a failed audit write must never block the underlying admin
   * action (the action itself already succeeded by the time this is called).
   */
  async record(entry: AdminAuditLogEntry): Promise<void> {
    try {
      await this.repository.save(
        this.repository.create({
          actorId: entry.actorId,
          action: entry.action,
          targetType: entry.targetType ?? null,
          targetId: entry.targetId ?? null,
          reason: entry.reason ?? null,
          metadata: entry.metadata ?? null,
        }),
      );
    } catch (err) {
      this.logger.error(
        `Failed to write admin audit log entry (action=${entry.action}, actor=${entry.actorId}): ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  async list(options: {
    page?: number;
    limit?: number;
    action?: string;
    actorId?: string;
    targetId?: string;
  }) {
    const page = clampPage(options.page ?? 1);
    const limit = clampLimit(options.limit ?? 50);

    const query = this.repository.createQueryBuilder('log').orderBy('log.createdAt', 'DESC');
    if (options.action) query.andWhere('log.action = :action', { action: options.action });
    if (options.actorId) query.andWhere('log.actorId = :actorId', { actorId: options.actorId });
    if (options.targetId) query.andWhere('log.targetId = :targetId', { targetId: options.targetId });

    const [rows, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: rows,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}
