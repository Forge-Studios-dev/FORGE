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

/**
 * Community classification. STANDARD is the default general community; EVENT is
 * an event-focused community (RSVPs/sessions front-and-centre). COURSE and
 * COHORT are system-managed and derived from course linkage — they are not
 * creator-selectable (see CREATOR_SELECTABLE_COMMUNITY_TYPES).
 */
export enum CommunityType {
  STANDARD = 'standard',
  COURSE = 'course',
  EVENT = 'event',
  COHORT = 'cohort',
}

/** Types a creator may assign directly; the rest are managed by the platform. */
export const CREATOR_SELECTABLE_COMMUNITY_TYPES: readonly CommunityType[] = [
  CommunityType.STANDARD,
  CommunityType.EVENT,
];

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

  @Column({ name: 'community_type', length: 32, default: CommunityType.STANDARD })
  communityType: CommunityType;

  @Column({ name: 'linked_course_id', type: 'uuid', nullable: true })
  linkedCourseId: string | null;

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
