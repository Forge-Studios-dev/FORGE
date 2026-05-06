import {
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  Column,
  JoinColumn,
} from 'typeorm';
import { Playlist } from './playlist.entity';
import { Video } from '../../content/entities/video.entity';

@Entity('playlist_videos')
@Unique(['playlistId', 'videoId'])
@Index(['playlistId'])
@Index(['videoId'])
export class PlaylistVideo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Playlist, (playlist) => playlist.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'playlist_id' })
  playlist: Playlist;

  @Column({ name: 'playlist_id' })
  playlistId: string;

  @ManyToOne(() => Video, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'video_id' })
  video: Video;

  @Column({ name: 'video_id' })
  videoId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

