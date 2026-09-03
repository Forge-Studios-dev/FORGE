import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * Entitlement-oriented soak (tiers + membership + feed + live).
 * Staging only — set BASE_URL. Optional TOKEN + CREATOR_ID for deeper paths.
 *
 *   k6 run -e BASE_URL=https://staging-api.example/api/v1 \
 *     -e TOKEN=eyJ... -e CREATOR_ID=uuid \
 *     scripts/load/entitlements-k6.js
 */
export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<800'],
  },
};

const BASE = __ENV.BASE_URL || 'http://127.0.0.1:3001/api/v1';
const TOKEN = __ENV.TOKEN || '';
const CREATOR_ID = __ENV.CREATOR_ID || '';

export default function () {
  const headers = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};

  const live = http.get(`${BASE}/streams/live`, { headers });
  check(live, { 'live list': (r) => r.status === 200 });

  const feed = http.get(`${BASE}/videos/feed?limit=20&sort=forYou`, { headers });
  check(feed, { 'feed': (r) => r.status === 200 || r.status === 401 });

  if (CREATOR_ID) {
    const tiers = http.get(`${BASE}/creators/${CREATOR_ID}/tiers`, { headers });
    check(tiers, { 'tiers': (r) => r.status === 200 || r.status === 404 });

    const membership = http.get(`${BASE}/creators/${CREATOR_ID}/membership/me`, { headers });
    check(membership, {
      'membership me': (r) => r.status === 200 || r.status === 401,
    });
  } else {
    const ready = http.get(`${BASE}/health/ready`, { headers });
    check(ready, { 'ready': (r) => r.status === 200 });
  }

  sleep(0.5);
}
