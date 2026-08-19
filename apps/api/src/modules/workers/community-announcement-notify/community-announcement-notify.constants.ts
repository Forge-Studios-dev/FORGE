export const COMMUNITY_ANNOUNCEMENT_NOTIFY_QUEUE = 'community-announcement-notify';

export type CommunityAnnouncementNotifyJobData = {
  communityId: string;
  postId: string;
  creatorId: string;
  title: string;
  body: string;
  /** Set by fanOut() as it progresses, so a BullMQ retry resumes instead of re-notifying earlier pages. */
  resumeOffset?: number;
};
