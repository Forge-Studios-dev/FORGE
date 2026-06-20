import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

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

