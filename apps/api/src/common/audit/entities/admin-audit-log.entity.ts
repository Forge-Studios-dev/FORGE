import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Durable trail for privileged admin actions (strikes, appeals, copyright
 * counter-notice rejection, impersonation, termination, moderation). Added
 * 2026-08-13 — the copyright/strikes system had no queryable "who did what,
 * when, why" record, which undercuts its own legal-defensibility purpose.
 */
@Entity('admin_audit_log')
@Index(['action', 'createdAt'])
@Index(['targetType', 'targetId'])
export class AdminAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'actor_id', type: 'uuid' })
  actorId: string;

  @Column({ type: 'varchar', length: 64 })
  action: string;

  @Column({ name: 'target_type', type: 'varchar', length: 32, nullable: true })
  targetType: string | null;

  @Column({ name: 'target_id', type: 'varchar', length: 64, nullable: true })
  targetId: string | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
