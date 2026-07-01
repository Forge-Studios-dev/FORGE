import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ConversationMember } from './conversation-member.entity';
import { DirectMessage } from './direct-message.entity';

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** true for group DM channels with 3+ participants */
  @Column({ name: 'is_group', default: false })
  isGroup: boolean;

  /** Optional display name for group conversations */
  @Column({ length: 100, nullable: true })
  name: string | null;

  /** Creator of the group conversation (null for 1:1 DMs) */
  @Column({ name: 'creator_id', type: 'uuid', nullable: true })
  creatorId: string | null;

  @OneToMany(() => ConversationMember, (m) => m.conversation)
  members: ConversationMember[];

  @OneToMany(() => DirectMessage, (m) => m.conversation)
  messages: DirectMessage[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
