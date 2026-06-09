import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('webhook_events')
@Index(['provider', 'eventId'], { unique: true })
export class WebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 32 })
  provider: string;

  @Column({ name: 'event_id', length: 255 })
  eventId: string;

  @Column({ name: 'event_type', length: 128, nullable: true })
  eventType: string | null;

  @Column({ name: 'processed_at', type: 'timestamptz' })
  processedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
