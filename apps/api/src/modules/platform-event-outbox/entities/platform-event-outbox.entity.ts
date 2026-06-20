import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum PlatformEventOutboxStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  PROCESSED = 'processed',
  FAILED = 'failed',
}

@Entity('platform_event_outbox')
@Index(['status', 'createdAt'])
export class PlatformEventOutbox {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_type', length: 128 })
  eventType: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 255, nullable: true })
  idempotencyKey: string | null;

  @Column({ length: 32, default: PlatformEventOutboxStatus.PENDING })
  status: PlatformEventOutboxStatus;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt: Date | null;
}
