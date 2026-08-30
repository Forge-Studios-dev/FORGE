import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Stream } from './stream.entity';
import { User } from '../../users/entities/user.entity';

@Entity('stream_clips')
@Index(['streamId', 'startOffsetMs'])
export class StreamClip {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'stream_id', type: 'uuid' })
  streamId: string;

  @ManyToOne(() => Stream, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stream_id' })
  stream: Stream;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 200, nullable: true })
  title: string | null;

  @Column({ name: 'start_offset_ms', type: 'bigint' })
  startOffsetMs: number;

  @Column({ name: 'end_offset_ms', type: 'bigint' })
  endOffsetMs: number;

  @Column({ type: 'varchar', length: 32, default: 'ready' })
  status: string;

  /** Mux asset id for the exported highlight clip (not the source live asset). */
  @Column({ name: 'mux_clip_asset_id', type: 'varchar', length: 64, nullable: true })
  muxClipAssetId: string | null;

  /** HLS URL once Mux export completes. */
  @Column({ name: 'playback_url', type: 'text', nullable: true })
  playbackUrl: string | null;

  @Column({ name: 'export_error', type: 'text', nullable: true })
  exportError: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
