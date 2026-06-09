import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Stream } from './stream.entity';

@Entity('stream_analytics_snapshots')
@Index(['streamId', 'recordedAt'])
export class StreamAnalyticsSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'stream_id', type: 'uuid' })
  streamId: string;

  @ManyToOne(() => Stream, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stream_id' })
  stream: Stream;

  @Column({ name: 'recorded_at', type: 'timestamptz' })
  recordedAt: Date;

  @Column({ name: 'concurrent_viewers', type: 'int', default: 0 })
  concurrentViewers: number;

  @Column({ name: 'chat_messages_per_min', type: 'int', default: 0 })
  chatMessagesPerMin: number;
}
