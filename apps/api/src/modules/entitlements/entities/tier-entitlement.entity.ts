import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SubscriptionTier } from './subscription-tier.entity';

export enum TierEntitlementResourceType {
  COMMUNITY = 'community',
  CHANNEL = 'channel',
  COURSE = 'course',
  VIDEO = 'video',
  STREAM = 'stream',
  EVENT = 'event',
  CREATOR = 'creator',
}

@Entity('tier_entitlements')
@Index(['tierId'])
@Index(['resourceType', 'resourceId'])
export class TierEntitlement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tier_id', type: 'uuid' })
  tierId: string;

  @ManyToOne(() => SubscriptionTier, (tier) => tier.entitlements, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tier_id' })
  tier: SubscriptionTier;

  @Column({ name: 'resource_type', length: 64 })
  resourceType: TierEntitlementResourceType;

  @Column({ name: 'resource_id', type: 'uuid', nullable: true })
  resourceId: string | null;

  @Column({ name: 'access_level', length: 64, default: 'full' })
  accessLevel: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
