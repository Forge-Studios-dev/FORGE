import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import type { NotificationPreferences } from '@forge/shared-types';
import { Video } from '../../content/entities/video.entity';
import { Stream } from '../../streaming/entities/stream.entity';
import { Like } from '../../engagement/entities/like.entity';
import { Comment } from '../../engagement/entities/comment.entity';
import { Follow } from '../../engagement/entities/follow.entity';
import { RefreshToken } from '../../auth/entities/refresh-token.entity';

export enum UserRole {
  USER = 'user',
  CREATOR = 'creator',
  ADMIN = 'admin',
}

export enum CreatorStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('users')
@Index(['email'], { unique: true })
@Index(['username'], { unique: true })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ unique: true, length: 50 })
  username: string;

  /** Last time the user changed their handle (cooldown for self-service rename). */
  @Column({ name: 'username_changed_at', type: 'timestamptz', nullable: true })
  usernameChangedAt: Date | null;

  @Column({ name: 'display_name', length: 100 })
  displayName: string;

  /** Postgres FTS column (generated). Not loaded by default. */
  @Column({ name: 'search_vector', type: 'tsvector', select: false, insert: false, update: false })
  searchVector?: string;

  @Column({ name: 'password_hash' })
  @Exclude()
  passwordHash: string;

  @Column({ nullable: true, length: 500 })
  bio: string;

  /** Primary website shown on the channel About tab. */
  @Column({ name: 'website_url', type: 'varchar', length: 500, nullable: true })
  websiteUrl: string | null;

  /** Extra channel links: [{ title, url }] (max 5). */
  @Column({ name: 'channel_links', type: 'jsonb', nullable: true })
  channelLinks: { title: string; url: string }[] | null;

  @Column({ name: 'avatar_url', nullable: true })
  avatarUrl: string;

  @Column({ name: 'banner_url', nullable: true })
  bannerUrl: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  @Column({
    name: 'creator_status',
    type: 'enum',
    enum: CreatorStatus,
    nullable: true,
  })
  creatorStatus: CreatorStatus | null;

  @Column({ name: 'creator_requested_at', type: 'timestamptz', nullable: true })
  creatorRequestedAt: Date | null;

  @Column({ name: 'creator_reviewed_at', type: 'timestamptz', nullable: true })
  creatorReviewedAt: Date | null;

  @Column({ name: 'creator_review_note', type: 'varchar', length: 500, nullable: true })
  creatorReviewNote: string | null;

  @Column({ name: 'is_verified', default: false })
  isVerified: boolean;

  /** Platform ban / admin deactivation — blocks login and refresh. */
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  /** Set by AccountStrikeService on a 2nd strike within 90 days (YouTube's own ladder) — blocks new uploads/streams until this passes. */
  @Column({ name: 'upload_restricted_until', type: 'timestamptz', nullable: true })
  uploadRestrictedUntil: Date | null;

  /** TOTP 2FA enrolled and active. Secret stays set (encrypted) even if this is false mid-enrollment. */
  @Column({ name: 'mfa_enabled', default: false })
  mfaEnabled: boolean;

  /** AES-256-GCM encrypted TOTP secret (see common/crypto/encryption.util.ts). Never returned to clients. */
  @Column({ name: 'mfa_secret_encrypted', type: 'varchar', nullable: true })
  @Exclude()
  mfaSecretEncrypted: string | null;

  /** bcrypt hashes of unused single-use backup codes; consumed (removed) on use. */
  @Column({ name: 'mfa_backup_code_hashes', type: 'jsonb', nullable: true })
  @Exclude()
  mfaBackupCodeHashes: string[] | null;

  /** Soft-delete timestamp — account removed from admin lists and sign-in. */
  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @Column({ name: 'email_verification_token_hash', type: 'varchar', nullable: true })
  @Exclude()
  emailVerificationTokenHash: string | null;

  @Column({ name: 'email_verification_expires_at', type: 'timestamptz', nullable: true })
  @Exclude()
  emailVerificationExpiresAt: Date | null;

  @Column({ name: 'follower_count', default: 0 })
  followerCount: number;

  @Column({ name: 'following_count', default: 0 })
  followingCount: number;

  @Column({ name: 'video_count', default: 0 })
  videoCount: number;

  @Column({ name: 'mature_content_acknowledged_at', type: 'timestamptz', nullable: true })
  matureContentAcknowledgedAt: Date | null;

  /** When true, VOD watch progress is not written to watch_history (views still count). */
  @Column({ name: 'watch_history_paused', default: false })
  watchHistoryPaused: boolean;

  /** Null means all categories on, no email digest — the zero-row default. */
  @Column({ name: 'notification_preferences', type: 'jsonb', nullable: true })
  notificationPreferences: NotificationPreferences | null;

  /** Watermark for the daily email digest job — null means never sent. */
  @Column({ name: 'last_email_digest_sent_at', type: 'timestamptz', nullable: true })
  lastEmailDigestSentAt: Date | null;

  @Column({ name: 'stripe_connect_account_id', type: 'varchar', length: 255, nullable: true })
  stripeConnectAccountId: string | null;

  @OneToMany(() => Video, (video) => video.user)
  videos: Video[];

  @OneToMany(() => Stream, (stream) => stream.user)
  streams: Stream[];

  @OneToMany(() => Like, (like) => like.user)
  likes: Like[];

  @OneToMany(() => Comment, (comment) => comment.user)
  comments: Comment[];

  @OneToMany(() => Follow, (follow) => follow.follower)
  following: Follow[];

  @OneToMany(() => Follow, (follow) => follow.following)
  followers: Follow[];

  @OneToMany(() => RefreshToken, (token) => token.user)
  refreshTokens: RefreshToken[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
