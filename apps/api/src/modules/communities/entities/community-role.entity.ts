import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Community } from './community.entity';
import { User } from '../../users/entities/user.entity';

export enum CommunityRoleType {
  OWNER = 'owner',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  COACH = 'coach',
}

@Entity('community_roles')
@Index(['communityId'])
export class CommunityRole {
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

  @Column({ length: 32 })
  role: CommunityRoleType;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
