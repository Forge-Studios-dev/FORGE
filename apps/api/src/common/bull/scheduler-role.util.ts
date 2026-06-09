/**
 * BullMQ repeatable jobs must register on exactly one process in production:
 * - Worker (`WORKER_ONLY=true`) owns schedulers in production
 * - Dev API process registers when no dedicated worker is running
 */
export function shouldRegisterBullScheduler(disableEnvKey?: string): boolean {
  if (disableEnvKey && process.env[disableEnvKey] === 'true') return false;
  if (process.env.WORKER_ONLY === 'true') return true;
  if (process.env.NODE_ENV === 'production') return false;
  return true;
}
