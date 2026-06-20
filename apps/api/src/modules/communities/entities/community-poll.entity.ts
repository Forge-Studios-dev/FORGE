import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Community } from './community.entity';

@Entity('community_polls')
@Index(['communityId', 'isActive'])
export class CommunityPoll {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'community_id', type: 'uuid' })
  communityId: string;

  @ManyToOne(() => Community, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'community_id' })
  community: Community;

  @Column({ length: 500 })
  question: string;

  @Column({ type: 'jsonb', default: [] })
  options: string[];

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'created_by_user_id', type: 'uuid' })
  createdByUserId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by_user_id' })
  createdBy: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt: Date | null;
}
