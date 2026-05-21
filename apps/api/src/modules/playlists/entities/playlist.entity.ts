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
  PRIVATE = 'private',
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

  @Column({
    type: 'enum',
    enum: PlaylistVisibility,
    default: PlaylistVisibility.PUBLIC,
  })
  visibility: PlaylistVisibility;

  @OneToMany(() => PlaylistVideo, (pv) => pv.playlist)
  items: PlaylistVideo[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

