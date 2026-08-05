import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PlaylistVideo } from './playlist-video.entity';

export enum PlaylistVisibility {
  PUBLIC = 'public',
  UNLISTED = 'unlisted',
  PRIVATE = 'private',
}

export enum PlaylistSystemType {
  WATCH_LATER = 'watch_later',
  LIKED = 'liked',
}

@Entity('playlists')
@Index(['userId'])
export class Playlist {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'varchar', nullable: true, length: 500 })
  description: string | null;

  @Column({
    type: 'enum',
    enum: PlaylistVisibility,
    default: PlaylistVisibility.PUBLIC,
  })
  visibility: PlaylistVisibility;

  /** System playlists (Watch later / Liked). Null for user-created playlists. */
  @Column({ name: 'system_type', type: 'varchar', length: 20, nullable: true })
  systemType: PlaylistSystemType | null;

  @OneToMany(() => PlaylistVideo, (pv) => pv.playlist)
  items: PlaylistVideo[];

  /** Populated by list queries via relation count — not a DB column. */
  videoCount?: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
