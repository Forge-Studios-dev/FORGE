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
import { User } from '../../users/entities/user.entity';
import { SubscriptionTier } from './subscription-tier.entity';

export enum MemberSubscriptionStatus {
  ACTIVE = 'active',
  CANCELED = 'canceled',
  EXPIRED = 'expired',
  TRIAL = 'trial',
  GRACE_PERIOD = 'grace_period',
  PAUSED = 'paused',
  RENEWAL_PENDING = 'renewal_pending',
  FAILED_PAYMENT = 'failed_payment',
  SUSPENDED = 'suspended',
  REFUNDED = 'refunded',
}

export enum MemberSubscriptionSource {
  MOCK = 'mock',
  ADMIN_GRANT = 'admin_grant',
  PAYMENT = 'payment',
  STRIPE = 'stripe',
}

@Entity('member_subscriptions')
@Index(['userId', 'creatorId', 'status'])
@Index(['creatorId', 'status'])
export class MemberSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'creator_id', type: 'uuid' })
  creatorId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creator_id' })
  creator: User;

  @Column({ name: 'tier_id', type: 'uuid' })
  tierId: string;

  @ManyToOne(() => SubscriptionTier, (tier) => tier.subscriptions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tier_id' })
  tier: SubscriptionTier;

  @Column({
    type: 'enum',
    enum: MemberSubscriptionStatus,
    default: MemberSubscriptionStatus.ACTIVE,
  })
  status: MemberSubscriptionStatus;

  @Column({
    type: 'enum',
    enum: MemberSubscriptionSource,
    default: MemberSubscriptionSource.MOCK,
  })
  source: MemberSubscriptionSource;

  @Column({ name: 'starts_at', type: 'timestamptz' })
  startsAt: Date;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({ name: 'external_ref', type: 'varchar', nullable: true, length: 255 })
  externalRef: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
