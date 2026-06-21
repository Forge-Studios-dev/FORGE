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
import { SubscriptionTier } from './subscription-tier.entity';
import { TierEntitlementResourceType } from './tier-entitlement.entity';

@Entity('creator_bundles')
@Index(['creatorId'])
export class CreatorBundle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'creator_id', type: 'uuid' })
  creatorId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creator_id' })
  creator: User;

  @Column({ name: 'tier_id', type: 'uuid' })
  tierId: string;

  @ManyToOne(() => SubscriptionTier, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tier_id' })
  tier: SubscriptionTier;

  @Column({ length: 120 })
  name: string;

  @Column({ length: 120 })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @OneToMany(() => CreatorBundleItem, (item) => item.bundle, { cascade: true })
  items: CreatorBundleItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('creator_bundle_items')
@Index(['bundleId'])
export class CreatorBundleItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'bundle_id', type: 'uuid' })
  bundleId: string;

  @ManyToOne(() => CreatorBundle, (bundle) => bundle.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bundle_id' })
  bundle: CreatorBundle;

  @Column({ name: 'resource_type', length: 64 })
  resourceType: TierEntitlementResourceType;

  @Column({ name: 'resource_id', type: 'uuid', nullable: true })
  resourceId: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}
