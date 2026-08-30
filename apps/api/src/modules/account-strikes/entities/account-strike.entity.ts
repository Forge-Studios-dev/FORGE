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

/**
 * Mirrors YouTube's own published Community Guidelines strike system
 * (warning -> 2-week upload restriction -> termination) and its separate
 * 3-strike copyright policy — using their public numbers as defaults since
 * this project's whole direction is YouTube parity, not inventing new
 * thresholds. Termination is never auto-executed here (see
 * AccountStrikeService.issueStrike) — only recommended, for an admin to act on.
 */
export enum StrikeType {
  COMMUNITY_GUIDELINE = 'community_guideline',
  COPYRIGHT = 'copyright',
}

export enum StrikeConsequence {
  WARNING = 'warning',
  UPLOAD_RESTRICTION_2W = 'upload_restriction_2w',
  TERMINATION_RECOMMENDED = 'termination_recommended',
}

export enum StrikeStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  RESCINDED = 'rescinded',
}

export enum AppealStatus {
  NONE = 'none',
  PENDING = 'pending',
  GRANTED = 'granted',
  DENIED = 'denied',
}

@Entity('account_strikes')
@Index(['userId', 'type', 'status'])
export class AccountStrike {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 32 })
  type: StrikeType;

  @Column({ type: 'varchar', length: 1000 })
  reason: string;

  @Column({ name: 'source_video_id', type: 'uuid', nullable: true })
  sourceVideoId: string | null;

  @ManyToOne(() => Video, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'source_video_id' })
  sourceVideo: Video | null;

  @Column({ name: 'source_report_id', type: 'uuid', nullable: true })
  sourceReportId: string | null;

  @Column({ type: 'varchar', length: 32 })
  consequence: StrikeConsequence;

  @Column({ type: 'varchar', length: 16, default: StrikeStatus.ACTIVE })
  status: StrikeStatus;

  @Column({ name: 'appeal_status', type: 'varchar', length: 16, default: AppealStatus.NONE })
  appealStatus: AppealStatus;

  @Column({ name: 'appeal_reason', type: 'varchar', length: 2000, nullable: true })
  appealReason: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  /** 90 days from issuance, matching YouTube's published strike-expiry window for both strike types. */
  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;
}
