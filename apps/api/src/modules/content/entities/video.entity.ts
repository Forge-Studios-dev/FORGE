import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Category } from '../../categories/entities/category.entity';
import { SkillTag } from '../../categories/entities/skill-tag.entity';
import { Like } from '../../engagement/entities/like.entity';
import { Comment } from '../../engagement/entities/comment.entity';

export enum VideoStatus {
  UPLOADING = 'uploading',
  PENDING = 'pending',
  PROCESSING = 'processing',
  READY = 'ready',
  FAILED = 'failed',
}

export enum VideoVisibility {
  PUBLIC = 'public',
  PRIVATE = 'private',
  UNLISTED = 'unlisted',
}

export enum ModerationStatus {
  NONE = 'none',
  HELD = 'held',
  BLOCKED = 'blocked',
}

export enum PublishStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
}

@Entity('videos')
@Index(['userId'])
@Index(['status'])
@Index(['createdAt'])
@Index(['categoryId'])
@Index(['publishStatus'])
export class Video {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.videos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'varchar', nullable: true, length: 2000 })
  description: string | null;

  /** Denormalized category + skill names for FTS (set at upload complete). */
  @Column({ name: 'tags_search_text', type: 'varchar', nullable: true, length: 2000 })
  tagsSearchText: string | null;

  @Column({
    type: 'enum',
    enum: VideoStatus,
    default: VideoStatus.PENDING,
  })
  status: VideoStatus;

  @Column({ name: 'upload_content_type', type: 'varchar', nullable: true, length: 100 })
  uploadContentType: string | null;

  @Column({ name: 'upload_file_size_bytes', type: 'bigint', nullable: true })
  uploadFileSizeBytes: number | null;

  @Column({ name: 'upload_completed_at', type: 'timestamptz', nullable: true })
  uploadCompletedAt: Date | null;

  @Column({ name: 'failure_reason', type: 'varchar', nullable: true, length: 500 })
  failureReason: string | null;

  @Column({
    type: 'enum',
    enum: VideoVisibility,
    default: VideoVisibility.PUBLIC,
  })
  visibility: VideoVisibility;

  @Column({ name: 's3_key', type: 'varchar', nullable: true })
  s3Key: string | null;

  @Column({ name: 'hls_url', type: 'varchar', nullable: true })
  hlsUrl: string | null;

  @Column({ name: 'thumbnail_url', type: 'varchar', nullable: true })
  thumbnailUrl: string | null;

  @Column({ name: 'duration_seconds', nullable: true, type: 'float' })
  durationSeconds: number | null;

  @Column({ name: 'file_size_bytes', nullable: true, type: 'bigint' })
  fileSizeBytes: number | null;

  @Column({ name: 'view_count', default: 0 })
  viewCount: number;

  @Column({ name: 'like_count', default: 0 })
  likeCount: number;

  @Column({ name: 'comment_count', default: 0 })
  commentCount: number;

  /** Postgres FTS column (generated). Not loaded by default. */
  @Column({ name: 'search_vector', type: 'tsvector', select: false, insert: false, update: false })
  searchVector?: string;

  @Column({
    name: 'publish_status',
    type: 'enum',
    enum: PublishStatus,
    default: PublishStatus.DRAFT,
  })
  publishStatus: PublishStatus;

  @ManyToOne(() => Category, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'category_id' })
  category: Category | null;

  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId: string | null;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @Column({ name: 'indexed_at', type: 'timestamptz', nullable: true })
  indexedAt: Date | null;

  @Column({ name: 'scheduled_publish_at', type: 'timestamptz', nullable: true })
  scheduledPublishAt: Date | null;

  @Column({
    name: 'moderation_status',
    type: 'enum',
    enum: ModerationStatus,
    default: ModerationStatus.NONE,
  })
  moderationStatus: ModerationStatus;

  @Column({ name: 'moderation_note', type: 'varchar', nullable: true, length: 500 })
  moderationNote: string | null;

  @Column({ name: 'moderated_at', type: 'timestamptz', nullable: true })
  moderatedAt: Date | null;

  @Column({ name: 'moderated_by', type: 'uuid', nullable: true })
  moderatedBy: string | null;

  @ManyToMany(() => SkillTag, (tag) => tag.videos)
  @JoinTable({
    name: 'video_skill_tags',
    joinColumn: { name: 'video_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'skill_tag_id', referencedColumnName: 'id' },
  })
  skillTags: SkillTag[];

  @OneToMany(() => Like, (like) => like.video)
  likes: Like[];

  @OneToMany(() => Comment, (comment) => comment.video)
  comments: Comment[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
