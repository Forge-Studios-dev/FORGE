import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CommunityPost } from './community-post.entity';
import { User } from '../../users/entities/user.entity';

@Entity('community_post_comments')
@Index(['postId', 'createdAt'])
export class CommunityPostComment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'post_id', type: 'uuid' })
  postId: string;

  @ManyToOne(() => CommunityPost, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post: CommunityPost;

  @Column({ name: 'author_id', type: 'uuid' })
  authorId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author: User;

  @Column({ type: 'text' })
  body: string;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId: string | null;

  @ManyToOne(() => CommunityPostComment, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent: CommunityPostComment | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
