import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity('channel_points_balances')
@Unique(['communityId', 'userId'])
@Index(['communityId'])
export class ChannelPointsBalance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'community_id', type: 'uuid' })
  communityId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'int', default: 0 })
  balance: number;

  @Column({ name: 'total_earned', type: 'int', default: 0 })
  totalEarned: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

export enum ChannelPointRewardStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  ARCHIVED = 'archived',
}

@Entity('channel_point_rewards')
@Index(['communityId', 'status'])
export class ChannelPointReward {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'community_id', type: 'uuid' })
  communityId: string;

  @Column({ length: 100 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'cost_points', type: 'int' })
  costPoints: number;

  @Column({ name: 'max_per_user', type: 'int', nullable: true })
  maxPerUser: number | null;

  @Column({ name: 'global_max', type: 'int', nullable: true })
  globalMax: number | null;

  @Column({ type: 'varchar', length: 20, default: ChannelPointRewardStatus.ACTIVE })
  status: ChannelPointRewardStatus;

  @Column({ name: 'requires_approval', default: false })
  requiresApproval: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

export enum ChannelPointRedemptionStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  FULFILLED = 'fulfilled',
}

@Entity('channel_point_redemptions')
@Index(['rewardId', 'status'])
@Index(['userId', 'rewardId'])
export class ChannelPointRedemption {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'reward_id', type: 'uuid' })
  rewardId: string;

  @Column({ name: 'community_id', type: 'uuid' })
  communityId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'cost_points', type: 'int' })
  costPoints: number;

  @Column({ type: 'varchar', length: 30, default: ChannelPointRedemptionStatus.PENDING })
  status: ChannelPointRedemptionStatus;

  @Column({ type: 'text', nullable: true })
  message: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
