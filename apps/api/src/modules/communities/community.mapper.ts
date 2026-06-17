import { Channel } from './entities/channel.entity';
import { ChannelMessage } from './entities/channel-message.entity';
import { Community } from './entities/community.entity';
import { CommunityCategory } from './entities/community-category.entity';
import { toPublicUser } from '../users/user.mapper';

export function toPublicCommunity(community: Community) {
  return {
    id: community.id,
    creatorId: community.creatorId,
    brandId: community.brandId,
    name: community.name,
    slug: community.slug,
    visibility: community.visibility,
    settings: community.settings,
    createdAt: community.createdAt,
  };
}

export function toPublicCategory(category: CommunityCategory) {
  return {
    id: category.id,
    communityId: category.communityId,
    name: category.name,
    slug: category.slug,
    sortOrder: category.sortOrder,
  };
}

export function toPublicChannel(
  channel: Channel,
  access?: { allowed: boolean; reason?: string | null },
) {
  return {
    id: channel.id,
    communityId: channel.communityId,
    categoryId: channel.categoryId,
    name: channel.name,
    slug: channel.slug,
    type: channel.type,
    requiredTierId: channel.requiredTierId,
    sortOrder: channel.sortOrder,
    createdAt: channel.createdAt,
    access: access ?? { allowed: true, reason: null },
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
