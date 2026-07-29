import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * Stub 100K-entitlement style load test (deferred backlog).
 * Does NOT hit production by default — set BASE_URL to staging.
 *
 * Example:
 *   k6 run -e BASE_URL=https://staging-api.example/api/v1 -e TOKEN=eyJ... scripts/load/entitlements-k6.js
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

export default function () {
  const headers = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};
  const res = http.get(`${BASE}/health/live`, { headers });
  check(res, { 'live ok': (r) => r.status === 200 });
  // Placeholder hot path — replace with feed + entitlement check when staging ready.
  if (TOKEN) {
    const feed = http.get(`${BASE}/videos/feed?limit=20`, { headers });
    check(feed, { 'feed ok': (r) => r.status === 200 || r.status === 401 });
  }
  sleep(0.5);
}
