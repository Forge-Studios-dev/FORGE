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

export enum StreamStatus {
  IDLE = 'idle',
  LIVE = 'live',
  ENDED = 'ended',
}

@Entity('streams')
@Index(['userId'])
@Index(['status'])
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

  @Column({ name: 'stream_key', nullable: true })
  streamKey: string;

  @Column({ name: 'rtmp_url', nullable: true })
  rtmpUrl: string;

  @Column({ name: 'playback_url', nullable: true })
  playbackUrl: string;

  @Column({ name: 'thumbnail_url', nullable: true })
  thumbnailUrl: string;

  @Column({
    type: 'enum',
    enum: StreamStatus,
    default: StreamStatus.IDLE,
  })
  status: StreamStatus;

  @Column({ name: 'viewer_count', default: 0 })
  viewerCount: number;

  @Column({ name: 'started_at', nullable: true })
  startedAt: Date;

  @Column({ name: 'ended_at', nullable: true })
  endedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
