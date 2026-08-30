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

export enum NotificationType {
  CREATOR_APPROVED = 'creator_approved',
  CREATOR_REJECTED = 'creator_rejected',
  VIDEO_READY = 'video_ready',
  STREAM_STARTED = 'stream_started',
  STREAM_STARTED_FOLLOWED = 'stream_started_followed',
  PREMIUM_CONTENT_NEW = 'premium_content_new',
  SUBSCRIPTION_EXPIRING = 'subscription_expiring',
  COMMENT_ON_VIDEO = 'comment_on_video',
  COMMENT_REPLY = 'comment_reply',
  NEW_FOLLOWER = 'new_follower',
  VIDEO_LIKED = 'video_liked',
  DIRECT_MESSAGE = 'direct_message',
  COMMUNITY_ROLE_ASSIGNED = 'community_role_assigned',
  COMMUNITY_BANNED = 'community_banned',
  COMMUNITY_POST_NEW = 'community_post_new',
  ACHIEVEMENT_UNLOCKED = 'achievement_unlocked',
  XP_LEVEL_UP = 'xp_level_up',
  SUPER_THANKS = 'super_thanks',
  COPYRIGHT_TAKEDOWN = 'copyright_takedown',
  COPYRIGHT_VIDEO_REINSTATED = 'copyright_video_reinstated',
  STRIKE_ISSUED = 'strike_issued',
  STRIKE_RESCINDED = 'strike_rescinded',
  STRIKE_APPEAL_RESOLVED = 'strike_appeal_resolved',
}

@Entity('notifications')
@Index(['userId'])
@Index(['createdAt'])
@Index('IDX_notifications_user_created', ['userId', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** FK already enforced by migration 222 (ON DELETE CASCADE). */
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  body: string | null;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
