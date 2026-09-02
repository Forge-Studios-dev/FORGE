# ADR-009: Pre-publish content scanning

**Status:** Accepted (2026-09-02) — blocker documented

## Context

`ContentScanService` defaults to `NoopContentScanProvider`. No CSAI/vendor integrated.

## Decision

Real vendor integration (Google CSAI Match, Thorn, or equivalent) is a **pre-launch blocker** for open public upload at scale. Engineering provides webhook provider hook; legal owns vendor selection.

## Consequences

- Track in risk register and production checklist
- `/health` surfaces `contentScan` status (already shipped)
