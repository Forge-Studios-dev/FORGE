/** Allowlisted analytics event names (API + clients). */
export const ANALYTICS_EVENTS = [
  'auth.signup',
  'auth.login',
  'auth.login.new_device',
  'watch.progress',
  'watch.complete',
  'watch.startup_ms',
  'search.query',
  'navigation.page',
  'studio.publish',
  'billing.checkout_started',
  'billing.checkout_returned',
  'billing.subscription_canceled',
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

const EVENT_SET = new Set<string>(ANALYTICS_EVENTS);

export function isAllowedAnalyticsEvent(name: string): name is AnalyticsEventName {
  return EVENT_SET.has(name);
}

/** Max serialized properties size (bytes) for ingest payloads. */
export const ANALYTICS_MAX_PROPERTIES_BYTES = 4096;
