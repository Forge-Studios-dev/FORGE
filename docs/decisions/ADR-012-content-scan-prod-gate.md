# ADR-012: Production content-scan noop gate

**Status:** Accepted (2026-09-03)  
**Related:** [ADR-009](./ADR-009-content-scanning.md)

## Context

Production can boot with `CONTENT_SCAN_PROVIDER=none` and auto-approve every Mux-ready video. Health reports `noop`, but nothing stopped a silent deploy.

## Research

Fail-closed safety configs (explicit acknowledgments) are standard for dangerous defaults: CSRF-off flags ignored in prod, mock subscriptions forbidden in prod (`env-production.schema.ts`). CSAM scanning deserves the same class of control.

## Alternatives considered

| Option | Why not |
|--------|---------|
| Fail boot until vendor webhook | Would take down current prod until legal signs a vendor — too coupled. |
| Warning log only | Already true; operators ignore logs. |

## Decision

In `NODE_ENV=production`:

- If `CONTENT_SCAN_PROVIDER=webhook`, require `CONTENT_SCAN_WEBHOOK_URL` (no silent fallback to noop).
- If provider is `none` (or unset), require `CONTENT_SCAN_ALLOW_NOOP=true` — an explicit operator acknowledgment that public UGC is **not** vendor-scanned.

This does **not** satisfy ADR-009. It makes the risk visible at boot.

## Consequences

- Fly must set `CONTENT_SCAN_ALLOW_NOOP=true` until a vendor is live (document in `CONTENT_SCANNING.md` / `DEPLOY.md`).
- Open public launch checklist cannot be green on acknowledgment alone.
