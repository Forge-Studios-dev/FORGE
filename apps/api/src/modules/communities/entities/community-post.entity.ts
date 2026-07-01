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
import { Community } from './community.entity';
import { User } from '../../users/entities/user.entity';

export enum CommunityPostType {
  POST = 'post',
  ANNOUNCEMENT = 'announcement',
  POLL = 'poll',
  ARTICLE = 'article',
  RESOURCE = 'resource',
  QA = 'qa',
}

@Entity('community_posts')
@Index(['communityId', 'createdAt'])
export class CommunityPost {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'community_id', type: 'uuid' })
  communityId: string;

  @ManyToOne(() => Community, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'community_id' })
  community: Community;

  @Column({ name: 'author_id', type: 'uuid' })
  authorId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author: User;

  @Column({ type: 'varchar', length: 300, nullable: true })
  title: string | null;

  @Column({ type: 'text' })
  body: string;

  @Column({ name: 'post_type', length: 32, default: CommunityPostType.POST })
  postType: CommunityPostType;

  @Column({ name: 'is_pinned', default: false })
  isPinned: boolean;

  /** For QA-type posts: the comment ID that was accepted as the best answer. */
  @Column({ name: 'accepted_answer_id', type: 'uuid', nullable: true })
  acceptedAnswerId: string | null;

  @Column({ name: 'media_urls', type: 'jsonb', default: [] })
  mediaUrls: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
