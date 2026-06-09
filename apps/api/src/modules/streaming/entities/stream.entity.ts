import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Category } from '../../categories/entities/category.entity';
import { SubscriptionTier } from '../../entitlements/entities/subscription-tier.entity';

export enum StreamStatus {
  IDLE = 'idle',
  LIVE = 'live',
  ENDED = 'ended',
}

export enum StreamVisibility {
  PUBLIC = 'public',
  FOLLOWERS = 'followers',
  SUBSCRIBERS = 'subscribers',
  TIER = 'tier',
  PRIVATE = 'private',
  PAID_EVENT = 'paid_event',
}

/** Chat participation gate — independent of stream visibility. */
export enum StreamChatMode {
  ALL = 'all',
  FOLLOWERS = 'followers',
  SUBSCRIBERS = 'subscribers',
  MODS_ONLY = 'mods_only',
}

@Entity('streams')
@Index(['userId'])
@Index(['status'])
@Index(['status', 'scheduledAt'])
export class Stream {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.streams, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ length: 200 })
  title: string;

  @Column({ nullable: true, length: 1000 })
  description: string;

  @Column({ name: 'mux_stream_id', nullable: true })
  muxStreamId: string;

  @Column({ name: 'mux_live_stream_id', nullable: true })
  muxLiveStreamId: string;

  @Column({ name: 'mux_asset_id', nullable: true })
  muxAssetId: string;

  @Column({ name: 'stream_key', type: 'varchar', nullable: true })
  streamKey: string | null;

  @Column({ name: 'rtmp_url', type: 'varchar', nullable: true })
  rtmpUrl: string | null;

  @Column({ name: 'playback_url', nullable: true })
  playbackUrl: string;

  @Column({ name: 'mux_playback_id', type: 'varchar', nullable: true })
  muxPlaybackId: string | null;

  @Column({ name: 'livekit_egress_id', type: 'varchar', nullable: true })
  livekitEgressId: string | null;

  @Column({ name: 'reminder_sent_at', type: 'timestamptz', nullable: true })
  reminderSentAt: Date | null;

  @Column({ name: 'mux_idle_since', type: 'timestamptz', nullable: true })
  muxIdleSince: Date | null;

  @Column({ name: 'thumbnail_url', nullable: true })
  thumbnailUrl: string;

  @Column({
    type: 'enum',
    enum: StreamStatus,
    default: StreamStatus.IDLE,
  })
  status: StreamStatus;

  @Column({
    type: 'enum',
    enum: StreamVisibility,
    default: StreamVisibility.PUBLIC,
  })
  visibility: StreamVisibility;

  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId: string | null;

  @ManyToOne(() => Category, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'category_id' })
  category: Category | null;

  @Column({ name: 'chat_enabled', default: true })
  chatEnabled: boolean;

  @Column({
    name: 'chat_mode',
    type: 'enum',
    enum: StreamChatMode,
    default: StreamChatMode.ALL,
  })
  chatMode: StreamChatMode;

  @Column({ name: 'record_enabled', default: true })
  recordEnabled: boolean;

  @Column({ name: 'age_restricted', default: false })
  ageRestricted: boolean;

  @Column({ name: 'required_tier_id', type: 'uuid', nullable: true })
  requiredTierId: string | null;

  @ManyToOne(() => SubscriptionTier, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'required_tier_id' })
  requiredTier: SubscriptionTier | null;

  @Column({ name: 'slow_mode_seconds', type: 'int', default: 0 })
  slowModeSeconds: number;

  @Column({ name: 'scheduled_at', type: 'timestamptz', nullable: true })
  scheduledAt: Date | null;

  @Column({ name: 'ticket_price_cents', type: 'int', nullable: true })
  ticketPriceCents: number | null;

  @Column({ name: 'pinned_message_id', type: 'uuid', nullable: true })
  pinnedMessageId: string | null;

  @Column({ name: 'viewer_count', default: 0 })
  viewerCount: number;

  @Column({ name: 'unique_viewer_count', type: 'int', default: 0 })
  uniqueViewerCount: number;

  @Column({ name: 'dvr_enabled', default: false })
  dvrEnabled: boolean;

  @Column({ name: 'started_at', nullable: true })
  startedAt: Date;

  @Column({ name: 'ended_at', nullable: true })
  endedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
