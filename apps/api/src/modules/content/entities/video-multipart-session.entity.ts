import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Video } from './video.entity';
import type { MultipartUploadState } from '../video-multipart.constants';

/** Postgres backup for multipart upload state (7d TTL); Redis remains hot cache (24h). */
@Entity('video_multipart_sessions')
@Index(['expiresAt'])
@Index(['userId'])
export class VideoMultipartSession {
  @PrimaryColumn('uuid', { name: 'video_id' })
  videoId!: string;

  @Column('uuid', { name: 'user_id' })
  userId!: string;

  @Column({ type: 'jsonb' })
  state!: MultipartUploadState;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @ManyToOne(() => Video, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'video_id' })
  video?: Video;
}
