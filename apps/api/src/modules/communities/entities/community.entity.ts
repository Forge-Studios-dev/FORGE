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
import { Channel } from './channel.entity';
import { Brand } from './brand.entity';
import { CommunityCategory } from './community-category.entity';

export enum CommunityVisibility {
  PUBLIC = 'public',
  PRIVATE = 'private',
  PAID = 'paid',
  INVITE = 'invite',
}

@Entity('communities')
@Index(['creatorId'])
export class Community {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'creator_id', type: 'uuid' })
  creatorId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creator_id' })
  creator: User;

  @Column({ name: 'brand_id', type: 'uuid', nullable: true })
  brandId: string | null;

  @ManyToOne(() => Brand, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'brand_id' })
  brand: Brand | null;

  @Column({ length: 200, default: 'Community' })
  name: string;

  @Column({ length: 100, default: 'community' })
  slug: string;

  @Column({ length: 32, default: CommunityVisibility.PUBLIC })
  visibility: CommunityVisibility;

  @Column({ type: 'jsonb', default: {} })
  settings: Record<string, unknown>;

  @OneToMany(() => Channel, (channel) => channel.community)
  channels: Channel[];

  @OneToMany(() => CommunityCategory, (category) => category.community)
  categories: CommunityCategory[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
