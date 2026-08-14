import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Video } from '../../content/entities/video.entity';

export enum VideoReactionType {
  LIKE = 'like',
  DISLIKE = 'dislike',
}

@Entity('likes')
@Unique(['userId', 'videoId'])
@Index(['videoId'])
@Index(['userId'])
@Index(['userId', 'reaction', 'createdAt'])
export class Like {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.likes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => Video, (video) => video.likes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'video_id' })
  video: Video;

  @Column({ name: 'video_id', type: 'uuid' })
  videoId: string;

  @Column({ type: 'varchar', length: 10, default: VideoReactionType.LIKE })
  reaction: VideoReactionType;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
