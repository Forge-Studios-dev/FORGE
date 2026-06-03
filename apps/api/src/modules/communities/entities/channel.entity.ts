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
import { Community } from './community.entity';
import { SubscriptionTier } from '../../entitlements/entities/subscription-tier.entity';
import { ChannelType } from '../../entitlements/entities/channel-type.enum';
import { ChannelMember } from './channel-member.entity';
import { ChannelMessage } from './channel-message.entity';

@Entity('channels')
@Index(['communityId'])
export class Channel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'community_id', type: 'uuid' })
  communityId: string;

  @ManyToOne(() => Community, (c) => c.channels, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'community_id' })
  community: Community;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 100 })
  slug: string;

  @Column({ type: 'enum', enum: ChannelType, default: ChannelType.PUBLIC })
  type: ChannelType;

  @Column({ name: 'required_tier_id', type: 'uuid', nullable: true })
  requiredTierId: string | null;

  @ManyToOne(() => SubscriptionTier, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'required_tier_id' })
  requiredTier: SubscriptionTier | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @OneToMany(() => ChannelMember, (m) => m.channel)
  members: ChannelMember[];

  @OneToMany(() => ChannelMessage, (m) => m.channel)
  messages: ChannelMessage[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
