# ADR-009: Pre-publish content scanning

**Status:** Accepted (2026-09-03) — revalidated zero-trust  
**Related:** [ADR-012](./ADR-012-content-scan-prod-gate.md)

## Context

`ContentScanService` defaults to `NoopContentScanProvider` (approve all). A webhook provider exists. Google CSAI Match / Thorn / PhotoDNA require legal agreements.

## Research

- YouTube: CSAI Match (known CSAM video fingerprints) + ML classifiers for novel CSAM + NCMEC CyberTipline. Egregious CSAM is immediate termination, not a 3-strike path.
- Google offers CSAI Match + Content Safety API to **qualifying partners** (not a drop-in npm package).
- Microsoft PhotoDNA is image-oriented; video platforms still need a video fingerprint vendor.
- Shipping public UGC **without** hash-matching is an unacceptable legal/safety risk at open scale. Engineering cannot sign the vendor contract.

## Alternatives considered

| Option | Why not |
|--------|---------|
| Treat noop as “good enough” | False sense of safety; health already labels `noop`. |
| Build in-house CSAM ML | Reckless and inferior to industry hash DBs. |
| Block all uploads until vendor | Overkill while approval gate + hold queue exist; still need a vendor for open launch. |

## Decision

Real vendor integration (Google CSAI Match, Thorn Safer, or equivalent video hash-matching) is a **pre-launch blocker for open public UGC at scale**. Engineering ships: webhook provider, fail-closed `hold` on vendor errors, admin held-video queue, admin notifications, production **explicit noop acknowledgment** (ADR-012). Legal owns vendor selection and NCMEC reporting process.

## Code evidence

- `apps/api/src/modules/content/content-scan/`
- Call sites: `MuxVodService.handleAssetReady`, FFmpeg worker
- Health: `checks.contentScan` = `noop` | `webhook` | `misconfigured`

## Consequences

- Do not market CSAM protection until a vendor is wired.
- `/health` and admin settings must stay honest about noop.
