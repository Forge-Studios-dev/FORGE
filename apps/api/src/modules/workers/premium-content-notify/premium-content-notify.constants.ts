export const PREMIUM_CONTENT_NOTIFY_QUEUE = 'premium-content-notify';

export type PremiumContentNotifyJobData = {
  videoId: string;
  creatorId: string;
  visibility: string;
  requiredTierId?: string | null;
  title: string;
};
