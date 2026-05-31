import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { Video } from '../../content/entities/video.entity';
import { Stream } from '../../streaming/entities/stream.entity';
import { Like } from '../../engagement/entities/like.entity';
import { Comment } from '../../engagement/entities/comment.entity';
import { Follow } from '../../engagement/entities/follow.entity';
import { RefreshToken } from '../../auth/entities/refresh-token.entity';

export enum UserRole {
  USER = 'user',
  CREATOR = 'creator',
  ADMIN = 'admin',
}

export enum CreatorStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('users')
@Index(['email'], { unique: true })
@Index(['username'], { unique: true })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ unique: true, length: 50 })
  username: string;

  @Column({ name: 'display_name', length: 100 })
  displayName: string;

  /** Postgres FTS column (generated). Not loaded by default. */
  @Column({ name: 'search_vector', type: 'tsvector', select: false, insert: false, update: false })
  searchVector?: string;

  @Column({ name: 'password_hash' })
  @Exclude()
  passwordHash: string;

  @Column({ nullable: true, length: 500 })
  bio: string;

  @Column({ name: 'avatar_url', nullable: true })
  avatarUrl: string;

  @Column({ name: 'banner_url', nullable: true })
  bannerUrl: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  @Column({
    name: 'creator_status',
    type: 'enum',
    enum: CreatorStatus,
    nullable: true,
  })
  creatorStatus: CreatorStatus | null;

  @Column({ name: 'creator_requested_at', type: 'timestamptz', nullable: true })
  creatorRequestedAt: Date | null;

  @Column({ name: 'creator_reviewed_at', type: 'timestamptz', nullable: true })
  creatorReviewedAt: Date | null;

  @Column({ name: 'creator_review_note', type: 'varchar', length: 500, nullable: true })
  creatorReviewNote: string | null;

  @Column({ name: 'is_verified', default: false })
  isVerified: boolean;

  /** Platform ban / admin deactivation — blocks login and refresh. */
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  /** Soft-delete timestamp — account removed from admin lists and sign-in. */
  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @Column({ name: 'email_verification_token_hash', type: 'varchar', nullable: true })
  @Exclude()
  emailVerificationTokenHash: string | null;

  @Column({ name: 'email_verification_expires_at', type: 'timestamptz', nullable: true })
  @Exclude()
  emailVerificationExpiresAt: Date | null;

  @Column({ name: 'follower_count', default: 0 })
  followerCount: number;

  @Column({ name: 'following_count', default: 0 })
  followingCount: number;

  @Column({ name: 'video_count', default: 0 })
  videoCount: number;

  @OneToMany(() => Video, (video) => video.user)
  videos: Video[];

  @OneToMany(() => Stream, (stream) => stream.user)
  streams: Stream[];

  @OneToMany(() => Like, (like) => like.user)
  likes: Like[];

  @OneToMany(() => Comment, (comment) => comment.user)
  comments: Comment[];

  @OneToMany(() => Follow, (follow) => follow.follower)
  following: Follow[];

  @OneToMany(() => Follow, (follow) => follow.following)
  followers: Follow[];

  @OneToMany(() => RefreshToken, (token) => token.user)
  refreshTokens: RefreshToken[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
