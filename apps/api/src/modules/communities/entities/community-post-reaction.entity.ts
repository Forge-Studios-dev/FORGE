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
import { CommunityPost } from './community-post.entity';
import { User } from '../../users/entities/user.entity';

export enum CommunityPostReactionType {
  LIKE = 'like',
}

@Entity('community_post_reactions')
@Index(['postId'])
@Unique(['postId', 'userId', 'reactionType'])
export class CommunityPostReaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'post_id', type: 'uuid' })
  postId: string;

  @ManyToOne(() => CommunityPost, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post: CommunityPost;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'reaction_type', length: 16, default: CommunityPostReactionType.LIKE })
  reactionType: CommunityPostReactionType;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
