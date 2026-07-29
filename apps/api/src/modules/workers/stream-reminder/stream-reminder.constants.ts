export const STREAM_REMINDER_QUEUE = 'stream-reminder';

export type StreamReminderJob = {
  /** When set, fire reminder for one stream (delayed job). Otherwise run backup scan. */
  streamId?: string;
};
