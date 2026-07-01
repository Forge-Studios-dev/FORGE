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
import { Community } from './community.entity';

@Entity('community_events')
@Index(['communityId', 'startsAt'])
export class CommunityEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'community_id', type: 'uuid' })
  communityId: string;

  @ManyToOne(() => Community, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'community_id' })
  community: Community;

  @Column({ name: 'creator_id', type: 'uuid' })
  creatorId: string;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'starts_at', type: 'timestamptz' })
  startsAt: Date;

  @Column({ name: 'ends_at', type: 'timestamptz', nullable: true })
  endsAt: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  location: string | null;

  @Column({ name: 'is_online', default: true })
  isOnline: boolean;

  @Column({ name: 'event_type', type: 'varchar', length: 16, default: 'one_off' })
  eventType: string;

  @Column({ name: 'recurrence_rule', type: 'varchar', length: 16, nullable: true })
  recurrenceRule: string | null;

  @Column({ name: 'recurrence_until', type: 'timestamptz', nullable: true })
  recurrenceUntil: Date | null;

  /** null = unlimited; >0 = max GOING RSVPs allowed (used for office_hours slots) */
  @Column({ type: 'int', nullable: true })
  capacity: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

export enum CommunityEventRsvpStatus {
  GOING = 'going',
  MAYBE = 'maybe',
  NOT_GOING = 'not_going',
}

@Entity('community_event_rsvps')
@Index(['eventId', 'userId'], { unique: true })
export class CommunityEventRsvp {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId: string;

  @ManyToOne(() => CommunityEvent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: CommunityEvent;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 16, default: CommunityEventRsvpStatus.GOING })
  status: CommunityEventRsvpStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
