import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export enum MentorshipRole {
  MENTOR = 'mentor',
  MENTEE = 'mentee',
}

export enum MentorshipProfileStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
}

@Entity('mentorship_profiles')
@Unique(['communityId', 'userId'])
@Index(['communityId', 'role', 'status'])
export class MentorshipProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'community_id', type: 'uuid' })
  communityId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 10 })
  role: MentorshipRole;

  @Column({ type: 'text', array: true, default: '{}' })
  skills: string[];

  @Column({ type: 'text', nullable: true })
  goals: string | null;

  @Column({ name: 'max_mentees', type: 'int', default: 3 })
  maxMentees: number;

  @Column({ type: 'varchar', length: 20, default: MentorshipProfileStatus.ACTIVE })
  status: MentorshipProfileStatus;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

export enum MentorshipMatchStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  DECLINED = 'declined',
}

@Entity('mentorship_matches')
@Unique(['mentorId', 'menteeId', 'communityId'])
@Index(['communityId', 'status'])
@Index(['menteeId', 'communityId'])
export class MentorshipMatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'community_id', type: 'uuid' })
  communityId: string;

  @Column({ name: 'mentor_id', type: 'uuid' })
  mentorId: string;

  @Column({ name: 'mentee_id', type: 'uuid' })
  menteeId: string;

  @Column({ type: 'varchar', length: 20, default: MentorshipMatchStatus.PENDING })
  status: MentorshipMatchStatus;

  @Column({ name: 'match_score', type: 'int', default: 0 })
  matchScore: number;

  @Column({ name: 'session_count', type: 'int', default: 0 })
  sessionCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
