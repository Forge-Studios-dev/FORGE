import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ArticleVisibility {
  PUBLIC = 'public',
  SUBSCRIBERS = 'subscribers',
  TIER = 'tier',
}

export enum ArticlePublishStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
}

@Entity('articles')
@Index(['creatorId'])
@Index(['creatorId', 'publishStatus'])
@Index(['creatorId', 'slug'], { unique: true })
export class Article {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'creator_id', type: 'uuid' })
  creatorId: string;

  @Column({ length: 200 })
  title: string;

  @Column({ length: 220 })
  slug: string;

  @Column({ type: 'text', nullable: true })
  excerpt: string | null;

  @Column({ name: 'body_markdown', type: 'text' })
  bodyMarkdown: string;

  @Column({ name: 'cover_image_url', type: 'text', nullable: true })
  coverImageUrl: string | null;

  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId: string | null;

  @Column({
    type: 'varchar',
    length: 15,
    default: ArticleVisibility.PUBLIC,
  })
  visibility: ArticleVisibility;

  @Column({ name: 'required_tier_id', type: 'uuid', nullable: true })
  requiredTierId: string | null;

  @Column({
    name: 'publish_status',
    type: 'varchar',
    length: 15,
    default: ArticlePublishStatus.DRAFT,
  })
  publishStatus: ArticlePublishStatus;

  @Column({ name: 'view_count', type: 'int', default: 0 })
  viewCount: number;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
