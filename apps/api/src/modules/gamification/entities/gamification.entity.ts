import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

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
