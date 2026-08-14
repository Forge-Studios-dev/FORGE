import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Video } from '../../content/entities/video.entity';

export enum ShareChannel {
  NATIVE = 'native',
  COPY_LINK = 'copy_link',
  EMBED = 'embed',
  OTHER = 'other',
}

/** Share events, for creator analytics — anonymous (userId null) shares are tracked too, unlike Like. */
@Entity('shares')
@Index(['videoId'])
@Index(['videoId', 'createdAt'])
export class Share {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Video, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'video_id' })
  video: Video;

  @Column({ name: 'video_id', type: 'uuid' })
  videoId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', length: 32, default: ShareChannel.OTHER })
  channel: ShareChannel;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
