import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { MemberSubscription } from './member-subscription.entity';
import { TierEntitlement } from './tier-entitlement.entity';

export enum BillingInterval {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
  LIFETIME = 'lifetime',
}

@Entity('subscription_tiers')
@Index(['creatorId'])
export class SubscriptionTier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'creator_id', type: 'uuid' })
  creatorId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creator_id' })
  creator: User;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 100 })
  slug: string;

  @Column({ name: 'price_cents', type: 'int', default: 0 })
  priceCents: number;

  @Column({ length: 3, default: 'INR' })
  currency: string;

  @Column({ type: 'jsonb', default: [] })
  benefits: string[];

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'stripe_product_id', type: 'varchar', length: 255, nullable: true })
  stripeProductId: string | null;

  @Column({ name: 'stripe_price_id', type: 'varchar', length: 255, nullable: true })
  stripePriceId: string | null;

  @Column({ name: 'billing_interval', length: 32, default: BillingInterval.MONTHLY })
  billingInterval: BillingInterval;

  @Column({ name: 'trial_days', type: 'int', default: 0 })
  trialDays: number;

  @Column({ name: 'max_concurrent_devices', type: 'int', default: 1 })
  maxConcurrentDevices: number;

  /** Null = unlimited seats. Set to cap enrollment on this tier. */
  @Column({ name: 'max_members', type: 'int', nullable: true })
  maxMembers: number | null;

  @OneToMany(() => TierEntitlement, (ent) => ent.tier)
  entitlements: TierEntitlement[];

  @OneToMany(() => MemberSubscription, (sub) => sub.tier)
  subscriptions: MemberSubscription[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
