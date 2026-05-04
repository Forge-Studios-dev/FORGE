import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Video } from '../../content/entities/video.entity';

@Entity('likes')
@Unique(['userId', 'videoId'])
@Index(['videoId'])
@Index(['userId'])
export class Like {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.likes, { onDelete: 'CASCADE' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => Video, (video) => video.likes, { onDelete: 'CASCADE' })
  video: Video;

  @Column({ name: 'video_id' })
  videoId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
