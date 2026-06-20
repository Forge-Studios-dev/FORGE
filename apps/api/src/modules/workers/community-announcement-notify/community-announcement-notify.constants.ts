export const COMMUNITY_ANNOUNCEMENT_NOTIFY_QUEUE = 'community-announcement-notify';

export type CommunityAnnouncementNotifyJobData = {
  communityId: string;
  postId: string;
  creatorId: string;
  title: string;
  body: string;
};
