/**
 * Cache-stampede protection for hot read-through caches (video detail, search).
 * Two independent, composable pieces — use either or both per cache site.
 */

const inFlight = new Map<string, Promise<unknown>>();

/**
 * Per-instance request coalescing: concurrent callers with the same `key` share
 * one in-flight `fn()` call instead of each hitting the DB on a cache miss.
 * Does not coordinate across instances — pair with jittered TTLs for that.
 */
export function singleFlight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;
  const promise = fn().finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

/** Randomizes a TTL by ±jitterRatio so many keys written together don't expire in lockstep. */
export function jitterTtl(baseTtlSec: number, jitterRatio = 0.15): number {
  const jitter = baseTtlSec * jitterRatio;
  const value = baseTtlSec + (Math.random() * 2 - 1) * jitter;
  return Math.max(1, Math.round(value));
}
