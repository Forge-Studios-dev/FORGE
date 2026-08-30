export const SCHEDULED_PUBLISH_QUEUE = 'scheduled-publish';

export type ScheduledPublishJob = {
  /** When set, index one video (delayed job). Otherwise run the backup scan. */
  videoId?: string;
};
