import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('member_xp')
@Index(['userId', 'communityId'], { unique: true })
export class MemberXp {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'community_id', type: 'uuid' })
  communityId: string;

  @Column({ type: 'int', default: 0 })
  xp: number;

  @Column({ type: 'int', default: 1 })
  level: number;

  @Column({ type: 'int', default: 0 })
  streak: number;

  @Column({ name: 'last_check_in_at', type: 'date', nullable: true })
  lastCheckInAt: string | null;

  @CreateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

/** Platform-wide XP — one row per user, accumulates across all communities. */
@Entity('platform_xp')
@Index(['userId'], { unique: true })
export class PlatformXp {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId: string;

  @Column({ type: 'int', default: 0 })
  xp: number;

  @Column({ type: 'int', default: 1 })
  level: number;

  @Column({ type: 'int', default: 0 })
  streak: number;

  @Column({ name: 'longest_streak', type: 'int', default: 0 })
  longestStreak: number;

  @Column({ name: 'last_check_in_at', type: 'date', nullable: true })
  lastCheckInAt: string | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

/** Audit log for XP grants — enforces daily anti-gaming limits per action. */
@Entity('platform_xp_grants')
@Index(['userId', 'actionType', 'grantedDate'])
export class PlatformXpGrant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'action_type', length: 30 })
  actionType: string;

  @Column({ name: 'xp_awarded', type: 'int' })
  xpAwarded: number;

  @Column({ name: 'granted_date', type: 'date' })
  grantedDate: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

/** Platform-wide achievement earned by a user — one row per unique unlock. */
@Entity('user_achievements')
@Index(['userId', 'key'], { unique: true })
export class UserAchievement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ length: 64 })
  key: string;

  @CreateDateColumn({ name: 'earned_at' })
  earnedAt: Date;
}

@Entity('member_badges')
export class MemberBadge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'badge_key', length: 64 })
  badgeKey: string;

  @Column({ name: 'community_id', type: 'uuid', nullable: true })
  communityId: string | null;

  @CreateDateColumn({ name: 'awarded_at' })
  awardedAt: Date;
}
