import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { SkillTag } from '../../categories/entities/skill-tag.entity';
import { Like } from '../../engagement/entities/like.entity';
import { Comment } from '../../engagement/entities/comment.entity';

export enum VideoStatus {
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

@Entity('videos')
@Index(['userId'])
@Index(['status'])
@Index(['createdAt'])
export class Video {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.videos, { onDelete: 'CASCADE' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ length: 200 })
  title: string;

  @Column({ nullable: true, length: 2000 })
  description: string;

  @Column({
    type: 'enum',
    enum: VideoStatus,
    default: VideoStatus.PENDING,
  })
  status: VideoStatus;

  @Column({
    type: 'enum',
    enum: VideoVisibility,
    default: VideoVisibility.PUBLIC,
  })
  visibility: VideoVisibility;

  @Column({ name: 's3_key', nullable: true })
  s3Key: string;

  @Column({ name: 'hls_url', nullable: true })
  hlsUrl: string;

  @Column({ name: 'thumbnail_url', nullable: true })
  thumbnailUrl: string;

  @Column({ name: 'duration_seconds', nullable: true, type: 'float' })
  durationSeconds: number;

  @Column({ name: 'file_size_bytes', nullable: true, type: 'bigint' })
  fileSizeBytes: number;

  @Column({ name: 'view_count', default: 0 })
  viewCount: number;

  @Column({ name: 'like_count', default: 0 })
  likeCount: number;

  @Column({ name: 'comment_count', default: 0 })
  commentCount: number;

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
