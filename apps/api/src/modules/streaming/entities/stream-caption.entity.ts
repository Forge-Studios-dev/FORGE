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
import { Video } from '../../content/entities/video.entity';

@Entity('stream_captions')
@Index(['streamId', 'language'])
export class StreamCaption {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'stream_id', type: 'uuid' })
  streamId: string;

  @ManyToOne(() => Stream, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stream_id' })
  stream: Stream;

  @Column({ name: 'video_id', type: 'uuid', nullable: true })
  videoId: string | null;

  @ManyToOne(() => Video, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'video_id' })
  video: Video | null;

  @Column({ length: 16, default: 'en' })
  language: string;

  @Column({ name: 'vtt_url', length: 2000 })
  vttUrl: string;

  @Column({ length: 32, default: 'manual' })
  source: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
