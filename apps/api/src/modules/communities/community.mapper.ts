import { Channel } from './entities/channel.entity';
import { ChannelMessage } from './entities/channel-message.entity';
import { toPublicUser } from '../users/user.mapper';

export function toPublicChannel(channel: Channel) {
  return {
    id: channel.id,
    communityId: channel.communityId,
    name: channel.name,
    slug: channel.slug,
    type: channel.type,
    requiredTierId: channel.requiredTierId,
    sortOrder: channel.sortOrder,
    createdAt: channel.createdAt,
  };
}

export function toPublicChannelMessage(msg: ChannelMessage) {
  return {
    id: msg.id,
    channelId: msg.channelId,
    userId: msg.userId,
    user: msg.user ? toPublicUser(msg.user) : undefined,
    body: msg.deletedAt ? '[deleted]' : msg.body,
    parentId: msg.parentId,
    deletedAt: msg.deletedAt,
    createdAt: msg.createdAt,
  };
}
