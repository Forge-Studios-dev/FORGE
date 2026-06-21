import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatorAuditLog } from './entities/community-room-message.entity';

@Injectable()
export class CreatorAuditService {
  constructor(
    @InjectRepository(CreatorAuditLog)
    private readonly auditRepository: Repository<CreatorAuditLog>,
  ) {}

  async log(input: {
    creatorId: string;
    actorId: string;
    action: string;
    resourceType?: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
  }) {
    await this.auditRepository.save(
      this.auditRepository.create({
        creatorId: input.creatorId,
        actorId: input.actorId,
        action: input.action,
        resourceType: input.resourceType ?? null,
        resourceId: input.resourceId ?? null,
        metadata: input.metadata ?? {},
      }),
    );
  }

  async listForCreator(creatorId: string, limit = 50) {
    const rows = await this.auditRepository.find({
      where: { creatorId },
      order: { createdAt: 'DESC' },
      take: Math.min(limit, 200),
    });
    return { data: rows };
  }

  @OnEvent('creator.audit.log')
  async handleAuditEvent(payload: {
    creatorId: string;
    actorId: string;
    action: string;
    resourceType?: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
  }) {
    await this.log(payload);
  }
}
