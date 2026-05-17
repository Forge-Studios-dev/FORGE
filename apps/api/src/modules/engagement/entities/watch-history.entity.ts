import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Video } from '../../content/entities/video.entity';

@Entity('watch_history')
export class WatchHistory {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @PrimaryColumn({ name: 'video_id', type: 'uuid' })
  videoId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Video, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'video_id' })
  video: Video;

  @Column({ name: 'progress_seconds', type: 'int', default: 0 })
  progressSeconds: number;

  @Column({ name: 'watched_at', type: 'timestamptz' })
  watchedAt: Date;
}
