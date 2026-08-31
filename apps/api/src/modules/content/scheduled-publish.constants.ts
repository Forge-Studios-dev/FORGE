export const SCHEDULED_PUBLISH_QUEUE = 'scheduled-publish';

/** Redis set of video ids with a future scheduledPublishAt (backup scan gate). */
export const SCHEDULED_PUBLISH_PENDING_KEY = 'videos:scheduled:pending';

export type ScheduledPublishJob = {
  /** When set, index one video (delayed job). Otherwise run the backup scan. */
  videoId?: string;
};
