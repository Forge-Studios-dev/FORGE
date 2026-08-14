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

export enum FollowNotifyLevel {
  ALL = 'all',
  PERSONALIZED = 'personalized',
  NONE = 'none',
}

@Entity('follows')
@Unique(['followerId', 'followingId'])
@Index(['followerId'])
@Index(['followingId'])
export class Follow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.following, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'follower_id' })
  follower: User;

  @Column({ name: 'follower_id', type: 'uuid' })
  followerId: string;

  @ManyToOne(() => User, (user) => user.followers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'following_id' })
  following: User;

  @Column({ name: 'following_id', type: 'uuid' })
  followingId: string;

  /** YouTube-style channel notification bell: all / personalized / none. */
  @Column({
    name: 'notify_level',
    type: 'enum',
    enum: FollowNotifyLevel,
    default: FollowNotifyLevel.ALL,
  })
  notifyLevel: FollowNotifyLevel;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
