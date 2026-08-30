import { isAllowedAnalyticsEvent, type AnalyticsEventName } from '@forge/shared-types/analytics';
import { api } from '@/lib/api';
import { getAppCheckToken } from '@/lib/app-check';
import { analyticsConsentGranted } from '@/lib/cookie-consent';

type TrackProps = Record<string, unknown>;

export async function trackEvent(
  eventName: AnalyticsEventName,
  properties?: TrackProps,
  videoId?: string,
) {
  if (!isAllowedAnalyticsEvent(eventName)) return;
  // Optional product analytics wait for cookie consent (essential-only = no fire).
  if (typeof window !== 'undefined' && !analyticsConsentGranted()) return;
  try {
    const headers: Record<string, string> = {};
    const appCheck = await getAppCheckToken();
    if (appCheck) headers['X-Firebase-AppCheck'] = appCheck;
    await api.post(
      '/analytics/events',
      { eventName, properties, videoId },
      { headers, validateStatus: (s) => s === 204 || s < 500 },
    );
  } catch {
    /* non-blocking */
  }
}

/** Sampled navigation tracking (10%). */
export function trackPageView(path: string) {
  if (typeof window === 'undefined') return;
  if (Math.random() > 0.1) return;
  void trackEvent('navigation.page', { path });
}

export function trackWatchProgress(videoId: string, positionSec: number) {
  void trackEvent('watch.progress', { positionSec }, videoId);
}

export function trackWatchComplete(videoId: string, durationSec: number) {
  void trackEvent('watch.complete', { durationSec }, videoId);
}

export function trackWatchStartup(videoId: string, ms: number) {
  void trackEvent('watch.startup_ms', { ms }, videoId);
}

export function trackSearchQuery(resultCount: number) {
  void trackEvent('search.query', { resultCount });
}

/** Fire once per video id per page session when a feed card becomes visible. */
const impressedVideoIds = new Set<string>();

export function trackVideoImpression(videoId: string, surface = 'feed') {
  if (typeof window === 'undefined') return;
  if (impressedVideoIds.has(videoId)) return;
  impressedVideoIds.add(videoId);
  void trackEvent('video.impression', { surface }, videoId);
}

