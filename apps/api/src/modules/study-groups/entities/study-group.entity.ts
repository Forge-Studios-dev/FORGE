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

export enum StudyGroupType {
  STUDY = 'study',
  ACCOUNTABILITY = 'accountability',
}

@Entity('study_groups')
@Index(['groupType', 'isPrivate'])
export class StudyGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId: string;

  @Column({
    name: 'group_type',
    type: 'varchar',
    length: 20,
  })
  groupType: StudyGroupType;

  @Column({ length: 200 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  topic: string | null;

  @Column({ name: 'course_id', type: 'uuid', nullable: true })
  courseId: string | null;

  /** Null = unlimited members. */
  @Column({ name: 'max_members', type: 'int', nullable: true })
  maxMembers: number | null;

  @Column({ name: 'is_private', default: false })
  isPrivate: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

export enum StudyGroupMemberRole {
  OWNER = 'owner',
  MEMBER = 'member',
}

export enum StudyGroupMemberStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
}

@Entity('study_group_members')
@Index(['groupId', 'userId'], { unique: true })
@Index(['groupId', 'status'])
export class StudyGroupMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId: string;

  @ManyToOne(() => StudyGroup, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group: StudyGroup;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 10, default: StudyGroupMemberRole.MEMBER })
  role: StudyGroupMemberRole;

  @Column({ type: 'varchar', length: 10, default: StudyGroupMemberStatus.ACTIVE })
  status: StudyGroupMemberStatus;

  @Column({ name: 'streak_count', type: 'int', default: 0 })
  streakCount: number;

  @Column({ name: 'last_check_in_at', type: 'timestamptz', nullable: true })
  lastCheckInAt: Date | null;

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt: Date;
}

export enum StudyGroupCheckInStatus {
  DONE = 'done',
  MISSED = 'missed',
}

@Entity('study_group_check_ins')
@Index(['groupId', 'createdAt'])
export class StudyGroupCheckIn {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId: string;

  @ManyToOne(() => StudyGroup, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group: StudyGroup;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 10, default: StudyGroupCheckInStatus.DONE })
  status: StudyGroupCheckInStatus;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
