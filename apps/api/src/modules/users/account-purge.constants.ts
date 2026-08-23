export const ACCOUNT_PURGE_QUEUE = 'account-purge';

export type AccountPurgeJob = Record<string, never>;

/** Grace period after account deletion before owned videos are hard-deleted (S3/Mux/DB). */
export const ACCOUNT_PURGE_GRACE_PERIOD_DAYS = 30;
