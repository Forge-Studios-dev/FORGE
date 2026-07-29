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

export enum ReportTargetType {
  VIDEO = 'video',
  USER = 'user',
  COMMENT = 'comment',
}

export enum ReportStatus {
  PENDING = 'pending',
  REVIEWED = 'reviewed',
  DISMISSED = 'dismissed',
}

// Moderation queue reads paginate pending reports by newest first
// (status='pending' ORDER BY created_at DESC). Composite index keeps
// that path index-only as the queue grows (H-B3).
@Index('IDX_reports_status_created_at', ['status', 'createdAt'])
@Entity('reports')
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reporter_id' })
  reporter: User;

  @Column({ name: 'reporter_id', type: 'uuid' })
  reporterId: string;

  @Column({ name: 'target_type', type: 'varchar', length: 32 })
  targetType: ReportTargetType;

  @Column({ name: 'target_id', type: 'uuid' })
  targetId: string;

  @Column({ type: 'varchar', length: 2000 })
  reason: string;

  @Column({ type: 'varchar', length: 32, default: ReportStatus.PENDING })
  status: ReportStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;
}
