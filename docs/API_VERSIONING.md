# FORGE API versioning policy (v1)

FORGE currently exposes a single versioned prefix:

- `/api/v1/...`

The goal of versioning is to keep client upgrades safe while still allowing the platform to evolve quickly.

## 1. What “v1 stable” means

- `v1` route paths and response shapes are treated as stable within the lifetime of v1.
- Fixes and improvements are allowed as long as they do not break existing clients (no removed required fields, no changed types/semantics without an explicit compatibility plan).

## 2. What requires a breaking change process

Treat a change as “breaking” when any of the following occurs:

- a response field is removed or becomes `null` where it used to be non-null
- the meaning of a field changes (e.g., `accessReason` values)
- authentication/authorization behavior changes in a way that invalidates existing integrations
- rate limiting / pagination semantics change in a way that can break clients
- an endpoint stops being available

## 3. Breaking changes: route or explicit deprecation window

For breaking changes, choose one of these approaches:

### Option A — Add a new route under a new version

- Create `/api/v2/...` (or higher) for the breaking behavior.
- Keep the `v1` behavior working until the deprecation window ends.

### Option B — Deprecate with an explicit notice (short-lived)

When you must avoid a new major prefix, add:

1. a deprecation notice in responses (recommended), and
2. a documented compatibility timeline.

Recommended headers (when available in your controller layer):

- `Deprecation: true`
- `Sunset: <RFC3339 timestamp>`
- `Link: </api/v2/...>; rel="deprecation"`

## 4. Deprecation timeline

- Minimum notice period: **90 days** for public API consumers.
- For internal-only changes (admin-only tooling, gated features), the notice window can be shorter, but the change must still be documented in the repo.

## 5. Client compatibility rules

- Prefer additive fields over modifying/removing existing fields.
- Avoid changing enum string values; if you must, accept old values for one full deprecation window.

