import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Channel } from './channel.entity';
import { CommunityRoom } from './community-room.entity';

@Entity('channel_room_mappings')
@Index(['channelId'], { unique: true })
@Index(['roomId'], { unique: true })
export class ChannelRoomMapping {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'channel_id', type: 'uuid' })
  channelId: string;

  @ManyToOne(() => Channel, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'channel_id' })
  channel: Channel;

  @Column({ name: 'room_id', type: 'uuid' })
  roomId: string;

  @ManyToOne(() => CommunityRoom, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_id' })
  room: CommunityRoom;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
