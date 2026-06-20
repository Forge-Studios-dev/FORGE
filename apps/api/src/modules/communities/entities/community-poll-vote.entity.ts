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
import { CommunityPoll } from './community-poll.entity';

@Entity('community_poll_votes')
@Index(['pollId', 'userId'], { unique: true })
export class CommunityPollVote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'poll_id', type: 'uuid' })
  pollId: string;

  @ManyToOne(() => CommunityPoll, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'poll_id' })
  poll: CommunityPoll;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'option_index', type: 'int' })
  optionIndex: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
