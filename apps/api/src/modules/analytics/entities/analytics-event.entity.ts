import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Video } from '../../content/entities/video.entity';

@Entity('analytics_events')
@Index(['eventName', 'createdAt'])
export class AnalyticsEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_name', length: 128 })
  eventName: string;

  @Column({ type: 'jsonb', nullable: true })
  properties: Record<string, unknown> | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => Video, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'video_id' })
  video: Video | null;

  @Column({ name: 'video_id', type: 'uuid', nullable: true })
  videoId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
