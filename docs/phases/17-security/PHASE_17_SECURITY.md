# Phase 17 — Security Platform

**Status:** Verified complete for baseline (no risky changes this pass)

## Verified present

- Helmet, CORS allowlists, CSRF cookies
- JWT + refresh rotation, session revoke UI
- Rate limits on chat / auth paths
- Admin robots noindex
- Playback URL sanitizers (HLS / thumb / captions)

## Deferred

- Geo anomaly login alerts
- Signed Mux playback URLs (DRM-grade)
