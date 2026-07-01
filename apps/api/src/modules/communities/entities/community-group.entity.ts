import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum CommunityGroupType {
  STUDY = 'study',
  ACCOUNTABILITY = 'accountability',
}

export enum CommunityGroupMemberRole {
  MEMBER = 'member',
  LEAD = 'lead',
}

@Entity('community_groups')
@Index(['communityId'])
export class CommunityGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'community_id', type: 'uuid' })
  communityId: string;

  @Column({ name: 'creator_id', type: 'uuid' })
  creatorId: string;

  @Column({ length: 120 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'group_type', length: 30, default: CommunityGroupType.STUDY })
  groupType: CommunityGroupType;

  @Column({ name: 'max_members', type: 'int', nullable: true })
  maxMembers: number | null;

  /** For accountability groups: weekly goal members commit to. */
  @Column({ name: 'weekly_goal', type: 'text', nullable: true })
  weeklyGoal: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

@Entity('community_group_members')
@Index(['groupId', 'userId'], { unique: true })
@Index(['userId'])
export class CommunityGroupMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ length: 20, default: CommunityGroupMemberRole.MEMBER })
  role: CommunityGroupMemberRole;

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt: Date;
}
