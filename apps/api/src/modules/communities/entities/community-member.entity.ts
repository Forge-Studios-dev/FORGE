import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Community } from './community.entity';
import { User } from '../../users/entities/user.entity';

export enum CommunityMemberStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  REJECTED = 'rejected',
}

export enum CommunityMemberSource {
  SUBSCRIPTION = 'subscription',
  INVITE = 'invite',
  JOIN_REQUEST = 'join_request',
  ADMIN = 'admin',
}

@Entity('community_members')
@Unique(['communityId', 'userId'])
@Index(['communityId', 'status'])
export class CommunityMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'community_id', type: 'uuid' })
  communityId: string;

  @ManyToOne(() => Community, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'community_id' })
  community: Community;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ length: 32, default: CommunityMemberStatus.ACTIVE })
  status: CommunityMemberStatus;

  @Column({ length: 32, default: CommunityMemberSource.JOIN_REQUEST })
  source: CommunityMemberSource;

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
