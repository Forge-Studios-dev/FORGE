# FORGE — Fresh Frontend UI/UX/Performance/Accessibility/SEO Audit

> **Historical snapshot — several findings are stale as of 2026-08-13.** The "Bar" line below
> ("not a YouTube clone") reflects the pre-2026-08-09 product framing, since reversed — FORGE is
> now the YouTube-replica (`FORGE_PROJECT_MASTER.md` §1). Courses (this doc's Critical #1, zero-SEO
> course pages) were removed entirely, not fixed. The Button focus-visible gap (High #3) shipped in
> commit `ee5bb27`. aria-label counts here (10 web / 1 admin) are stale — current counts are far
> higher. Re-verify any finding against current code/git-blame before actioning; don't diff against
> this doc as a checklist.

**Date:** 2026-07-26
**Scope:** `apps/web` (public site, 224 TS/TSX under `src`, 302 total incl. config) and `apps/admin` (37 TS/TSX under `src`, 64 total), plus `packages/design-system` as the shared foundation.
**Reviewers (persona lenses):** Senior React/Next.js Engineer, Senior UI Designer, Senior UX Researcher, Senior Accessibility Expert, Senior SEO Expert.
**Bar:** FORGE's stated identity — "premium, modern, creator-first, not a YouTube clone," blending YouTube/Skillshare/Twitch/Patreon/Coursera — judged against Airbnb/Stripe/Notion/Linear/Figma-caliber polish.

## Method

This is an independent, from-scratch audit. No prior audit document was read before forming findings (a pre-existing `docs/audits/FORGE_MASTER_AUDIT_2026-07-22.md` covers backend/infra/mobile more than frontend and is intentionally not the basis for what follows — findings below were re-derived from current source). Work consisted of: a full route inventory (`find … -name page.tsx`, 62 web + 17 admin pages), grep-based signal sweeps (design-system import rate, `'use client'` density, `next/image` vs raw `<img>`, hex-color drift, `dark:` variant usage, `aria-label`/`role`/`focus` density, virtualization/memoization usage, metadata coverage across every page), and direct reads of ~25 representative files spanning auth (login/signup), home feed, watch page, explore/discover, upload flow, creator studio (videos/moderation/analytics), profile, and admin (dashboard, users, creator-approvals, fraud, settings, unauthorized) plus the design-system primitives (`Button`, `Input`, `LoadingSkeleton`, `DataTable`, `EmptyState`) and `sitemap.ts`/`robots.ts`/root `layout.tsx`.

---

## Findings by Severity

### Critical

**1. Course catalog and course detail pages are fully client-rendered with zero SEO surface and are absent from the sitemap.**
- File(s): `apps/web/src/app/discover/courses/page.tsx`, `apps/web/src/app/courses/[id]/page.tsx`
- Current implementation: Both start with `'use client'`, fetch data client-side via `useQuery`/`useState`, have no `export const metadata` and no `generateMetadata`. `apps/web/src/app/sitemap.ts` enumerates static routes, skill-tag routes, video routes (`/watch/[id]`), and creator routes (`/username`) — it never emits `/courses/[id]` or `/discover/courses/*` URLs at all.
- Problem: Courses — a core monetizable content type per FORGE's Coursera-inspired identity — are invisible to search crawlers (no server HTML, no `<title>`/OG tags, not in the sitemap) while `/watch/[id]` and profile pages get full `generateMetadata` + JSON-LD treatment (see `watch/[id]/page.tsx`). This is an internal inconsistency, not a platform-wide constraint — the pattern already exists elsewhere in the same codebase and simply wasn't applied here.
- Why it matters: Organic discovery is a named platform-growth pillar (per FORGE direction docs); a whole content vertical currently cannot be found via Google, cannot be shared with a rich preview, and has generic browser-tab titles.
- Recommended solution: Convert to a Server Component wrapper (`async function CoursePage`) that fetches via `serverApi` and passes data to a client sub-component for interactivity, mirroring `watch/[id]/page.tsx`'s split; add `generateMetadata`; add course routes to `sitemap.ts`.
- Best-practice reference: Next.js App Router SSR/metadata patterns; Google SEO starter guide (crawlable HTML requirement).
- Estimated effort: M (1-2 days, two files + sitemap).
- Expected impact: High — unlocks organic search for an entire content type.

### High

**2. `dark:` Tailwind variants are used nowhere in the codebase — there is no light theme, and it's hard-coded.**
- File(s): `apps/web/src/app/layout.tsx` (`<html lang="en" className="dark">`), confirmed by zero `dark:` matches across `apps/web/src` and `apps/admin/src`.
- Current implementation: A single dark theme is force-applied at the HTML root with no toggle, no `prefers-color-scheme` handling, no light-mode token set exercised anywhere.
- Problem: The task brief and design-system tokens imply "dark mode support" as a checked dimension, but there is no *mode* — there is one fixed theme. Users who need light mode (bright-environment readability, light sensitivity, OS-level preference, print) have no path.
- Why it matters: Twitch/Discord-style single-dark-theme is a legitimate premium choice, but it should be a documented decision, not a byproduct of never having built the alternative — and it's a real accessibility gap for users who specifically need light backgrounds.
- Recommended solution: Either explicitly document "dark-only by design" as a product decision, or add a light-theme token set + `prefers-color-scheme`/toggle using the existing CSS-variable token architecture in `packages/design-system/tailwind/theme.css` (tokens are already variable-based, so this is additive, not a rewrite).
- Best-practice reference: WCAG 1.4.8 (visual presentation, user-controllable), Apple HIG "support Dark Mode and Light Mode."
- Estimated effort: L if building real light mode (3-5 days); S if just documenting the decision.
- Expected impact: Medium — affects a subset of users but is a visible polish/accessibility gap against the Stripe/Notion/Linear bar (all ship both modes).

**3. Interactive focus states are inconsistent across the design system's own primitives.**
- File(s): `packages/design-system/src/react/Button.tsx` vs `packages/design-system/src/react/Input.tsx`
- Current implementation: `Input.tsx` wires `focus:outline-none focus:ring-1` plus error-state ring color — solid. `Button.tsx`'s `base` class string has no `focus:` treatment at all (`inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed`), so every primary/secondary/ghost/outline button falls back to the bare browser default outline (or none, depending on OS/browser). Only 4 files total in both apps reference `focus-visible`/`focus:ring`/`focus:outline`.
- Problem: Since `Button` is the single shared primitive used across both apps, this is a systemic keyboard-navigation gap, not a per-page one.
- Why it matters: Keyboard and screen-magnifier users lose visible focus tracking on every button-driven flow — form submits, bulk actions in admin, studio publish/cancel actions.
- Recommended solution: Add a `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2` treatment to `Button`'s `base` class, matching `Input`'s ring token usage.
- Best-practice reference: WCAG 2.4.7 (Focus Visible), WCAG 2.4.11 (Focus Appearance, AA).
- Estimated effort: S (single file, <1 day incl. visual QA across variants).
- Expected impact: High relative to effort — one shared component fix propagates everywhere.

**4. `aria-label` coverage is very thin relative to interactive-element surface.**
- File(s): codebase-wide — only 10 files in `apps/web/src` and 1 file in `apps/admin/src` contain any `aria-label`; `role="..."` appears in only 7 files total.
- Current implementation: Icon-only buttons (nav, close/dismiss, bulk-action icons, `Icon` component usages throughout studio/admin) largely rely on visible text or nothing, per the grep sweep.
- Problem: Icon-driven UI (heavily used per the `Icon` import count in `explore`, `studio`, admin tables) without a paired accessible name is unusable via screen reader.
- Why it matters: This is a WCAG 4.1.2 (Name, Role, Value) baseline requirement, and admin in particular (moderation/fraud/user-management, i.e. operational tooling) needs to be screen-reader operable for compliance-sensitive teams.
- Recommended solution: Audit `Icon`-only buttons/links (studio nav, admin bulk-action bar, table row actions) and add `aria-label` or visually-hidden text; consider a lint rule (`eslint-plugin-jsx-a11y`) to prevent regressions.
- Best-practice reference: WCAG 4.1.2, WAI-ARIA Authoring Practices.
- Estimated effort: M (2-3 days sweep across both apps).
- Expected impact: High for accessibility compliance; also reduces future regressions if paired with a lint rule.

**5. React Hook Form / schema-driven validation is essentially unused; forms hand-roll `useState` + manual submit validation.**
- File(s): `apps/web/src/app/(auth)/login/LoginForm.tsx` and by extension every other form in the app (`react-hook-form` matched 0 files across both apps; `zod` matched only 2 files).
- Current implementation: Forms use `useState` per field, `required` HTML attributes, and try/catch around the submit `api.post` call for server-side error surfacing. Login specifically does this well (proper `htmlFor`/`id`, `disabled={loading}` on submit — good double-submit protection), but the pattern isn't reusable and each form reimplements it.
- Problem: No consistent client-side validation layer means inline field-level errors (as opposed to only top-of-form banner errors) are inconsistent across forms, and there's no shared debounced-validation or schema reuse between client and any future server DTO validation.
- Why it matters: At Stripe/Linear-caliber polish, field-level real-time validation with clear inline messaging is expected UX, not just a submit-time banner.
- Recommended solution: Introduce `react-hook-form` + `zod` (already a light dependency, and Input already exposes an `error` prop wired to `aria-invalid`/`aria-describedby` — this is a drop-in target) for the highest-traffic forms first (auth, upload metadata, studio settings).
- Best-practice reference: Nielsen Norman Group inline validation guidance; NN/g form design heuristics.
- Estimated effort: L (form-by-form migration, 1-2 weeks phased).
- Expected impact: Medium-High — most visible on signup/upload where field errors currently only surface after a round trip.

**6. Admin has zero loading-skeleton usage; all loading states are binary spinners/blank-until-loaded.**
- File(s): `apps/admin/src/app` — `Skeleton` component matched 0 usages in admin vs 18 in `apps/web/src` (web has `loading.tsx` route-level skeletons for `messages`, `library`, `explore`, `search`, `history`, `notifications`, plus component-level use in `ContinueWatching`, `HomeFeedTabs`).
- Current implementation: Admin pages (dashboard, users, reports, fraud) use `useQuery`'s `isLoading` to gate a `DataTable`'s `loading` prop, but there's no skeleton for the KPI/stat cards or the triage-queue cards on the dashboard — they simply don't render until data resolves.
- Problem: Perceived performance on the admin dashboard (which does 4 parallel `useQuery` calls — stats, pending creators, reports, fraud alerts) is worse than it needs to be; layout shift as each card pops in.
- Why it matters: Admin is used daily by operators; unindicated loading reads as "is this broken" more than on a consumer surface visited less frequently.
- Recommended solution: Reuse `packages/design-system`'s existing `StatCardsSkeleton`/`SkeletonBlock` (already exported, already used on web) for the admin dashboard's stat row and triage list.
- Best-practice reference: Material 3 loading-state guidance (skeleton over spinner for content-shaped placeholders).
- Estimated effort: S (design-system component already exists — this is wiring, not building).
- Expected impact: Medium — cheap fix, meaningfully better perceived performance for daily admin users.

### Medium

**7. `'use client'` density is high on the web app (127/224 files, ~57%), including some large, data-fetching-heavy pages that could be server components.**
- File(s): e.g. `apps/web/src/app/discover/courses/page.tsx`, `apps/web/src/app/courses/[id]/page.tsx` (see Critical #1), `apps/web/src/app/upload/step/[step]/page.tsx` (587 lines, entirely client, understandably — it's a stateful multi-step wizard with file handling).
- Problem: Not every client component here is a mistake — video player, feed, upload wizard, and real-time surfaces legitimately need client interactivity — but the two course pages are pure data-fetch-and-render with no urgent interactivity need, making them clear over-conversions to client-side.
- Why it matters: More client JS shipped than necessary increases bundle size and delays interactivity (TTI) for content that could be static/ISR.
- Recommended solution: Same fix as Critical #1 — convert to server-rendered shells with client islands only where interaction is needed (favorite/enroll button, filters).
- Best-practice reference: Next.js Server Components guidance ("fetch data where it's used, minimize client boundary").
- Estimated effort: Bundled with Critical #1.
- Expected impact: Medium — marginal bundle-size win beyond the SEO win already counted.

**8. SEO metadata coverage is inconsistent even among crawlable public routes.**
- File(s): `apps/web/src/app/discover/communities/page.tsx`, `apps/web/src/app/playlists/[id]/page.tsx`, `apps/web/src/app/[username]/programs/[slug]/page.tsx`, `apps/web/src/app/live/[id]/page.tsx` — none export `metadata` or `generateMetadata` (verified via a full-page metadata sweep: only 10 of 62 web `page.tsx` files have any metadata export).
- Problem: Most of the 52 pages without metadata are legitimately private/auth-gated (studio, settings, messages) and correctly excluded via `robots.ts`'s `disallow` list — that part is well-executed. But `discover/communities`, `playlists/[id]`, creator `programs/[slug]`, and `live/[id]` are public content surfaces without page-specific titles/descriptions, so they'll show generic fallback titles in search results and social shares.
- Why it matters: Inconsistent metadata means some content ranks/shares well (videos, profiles) and adjacent content types don't, which is confusing both for SEO tooling and for future maintainers who won't have an obvious pattern to follow.
- Recommended solution: Add `generateMetadata` to the four routes above, following the `watch/[id]/page.tsx` template (already the best example in the codebase).
- Best-practice reference: Open Graph protocol, Google title/description guidelines.
- Estimated effort: S-M (a few hours per route).
- Expected impact: Medium.

**9. JSON-LD structured data exists in exactly one place.**
- File(s): `apps/web/src/components/seo/JsonLd.tsx`, used only on `watch/[id]` and `[username]` per grep (1 file match for `application/ld+json` usage pattern — actually the component itself, consumed in 2 pages).
- Problem: `VideoObject` schema is on watch pages, but there's no `Course`, `Person` (creator), `BreadcrumbList`, or `Organization` schema anywhere else, despite courses/creators being first-class content types.
- Why it matters: Structured data is what unlocks rich results (video carousels, course cards) in search — currently only the video vertical is eligible.
- Recommended solution: Extend `JsonLd` usage to course pages (`Course` schema) once Critical #1 is fixed, and add `Person`/`ProfilePage` schema to creator profiles.
- Best-practice reference: schema.org, Google rich-results eligibility docs.
- Estimated effort: S once course SSR exists.
- Expected impact: Medium.

**10. No PWA manifest despite an explicit `offline/page.tsx` route implying offline-support intent.**
- File(s): `apps/web/src/app/offline/page.tsx` exists; no `manifest.json`/`manifest.ts` found anywhere under `apps/web`.
- Problem: An offline fallback page without a web app manifest (and, likely, without a service worker registering it) suggests either half-built PWA infrastructure or a page that's currently unreachable in normal flows.
- Why it matters: If offline support is a stated goal (consistent with the mobile app's offline-first mindset per `forge-mobile.md`), the web surface is incomplete; if it's not a goal, this is dead code worth removing.
- Recommended solution: Either complete the PWA setup (manifest + service worker + install prompt) or remove the orphaned route.
- Best-practice reference: web.dev PWA checklist.
- Estimated effort: S to investigate/decide; M-L to fully implement PWA.
- Expected impact: Low-Medium.

**11. `React.memo` is used nowhere in `apps/web/src/components` despite large, frequently-re-rendering list surfaces.**
- File(s): grep for `memo(`/`React.memo` across `apps/web/src/components` returned 0 matches.
- Problem: Note the primary feed (`FeedGrid.tsx`) already does the *harder* right thing — it uses `@tanstack/react-virtual`'s `useWindowVirtualizer`, which is genuinely well-engineered and above typical mid-size SaaS baseline. But individual row/card components (`FeedCard`, comment rows, notification rows) aren't memoized, so state changes in a parent (e.g., a like-count update, a scroll-margin recalculation) can still cascade re-renders through visible rows.
- Why it matters: On lower-end devices, unnecessary re-renders inside an already-large visible window compound into jank, partially offsetting the virtualization win.
- Recommended solution: Wrap `FeedCard` and similar list-row components in `React.memo` with a shallow-props comparator; verify with React DevTools profiler on the home feed.
- Best-practice reference: React performance docs (memoization for expensive list items).
- Estimated effort: S-M.
- Expected impact: Medium.

**12. Admin uses raw `<table>` markup in at least one screen instead of the shared `DataTable`.**
- File(s): 1 file matched `<table` directly in `apps/admin/src` while `DataTable` is used in 6 files (users, content, creator-approvals, reports, etc.).
- Problem: Minor inconsistency — most admin list screens get `DataTable`'s built-in loading/empty/selection/bulk-action affordances (confirmed reading `users/page.tsx`: `loading`, `selectable`, `emptyState`, `bulkActions` all wired), but at least one screen bypasses that for hand-rolled markup, meaning it likely lacks the same keyboard/roving-tabindex behavior the design-system's own `DataTable` provides (per the prior master audit's note that `DataTable` has roving-tabindex keyboard nav).
- Why it matters: Inconsistent interaction model across admin list screens; the outlier screen is accessibility-behind its siblings.
- Recommended solution: Identify and migrate the outlier screen to `DataTable`.
- Best-practice reference: Internal consistency (Nielsen heuristic #4).
- Estimated effort: S.
- Expected impact: Low-Medium.

### Low

**13. Skip-to-content link and semantic landmarks are present at the shell level (good) but not verified consistently in leaf pages.**
- File(s): `apps/web/src/app/layout.tsx` has a proper `.sr-only focus:not-sr-only` skip link targeting `#main-content` — this is genuinely well done and above-baseline. Spot-checked leaf pages (`explore/page.tsx`) use `<main>` correctly. No systemic issue found, but coverage wasn't exhaustively verified across all 62 pages within the audit's time budget.
- Recommendation: Low-priority spot audit during any future a11y pass; not a blocking finding.
- Estimated effort: S. Expected impact: Low.

**14. Zero hardcoded hex colors found in either app — genuinely strong design-token discipline.**
- File(s): codebase-wide grep for `#[0-9a-fA-F]{3,6}` returned 0 matches in both `apps/web/src` and `apps/admin/src` (colors only exist as CSS variables in `packages/design-system/tailwind/theme.css`).
- This is a **positive finding**, called out because the audit brief specifically asked for hex-color drift as a proxy signal — there is none. Noted here rather than omitted, for completeness.

**15. Admin responsive-breakpoint usage is comparatively thin (13 files use `sm:/md:/lg:/xl:` vs 85 in web).**
- File(s): `apps/admin/src` (37 files total, only 13 touch a breakpoint prefix).
- Problem: Given admin has far fewer files, this isn't necessarily alarming, but spot-checking `dashboard/page.tsx` shows only `sm:`/`lg:` on grid layouts, no `md:` tier — meaning tablet-width admin usage likely jumps straight from 1-column to 2/4-column with no intermediate step.
- Why it matters: Admin is plausibly used on tablets by on-call moderators; an abrupt breakpoint jump can cause cramped 2-up cards on mid-size viewports.
- Recommended solution: Add `md:` intermediate breakpoints to the dashboard grid and other multi-column admin screens.
- Best-practice reference: Standard responsive grid practice (mobile/tablet/desktop 3-tier).
- Estimated effort: S. Expected impact: Low.

---

## Notable Strengths (for balance)

- `watch/[id]/page.tsx` is a genuinely strong SSR/SEO template: `generateMetadata`, OpenGraph + Twitter cards, JSON-LD `VideoObject`, `notFound()` handling — this should be the pattern copied for courses (Critical #1).
- `sitemap.ts` is well-engineered: bounded pagination (`MAX_VIDEO_PAGES`), hourly ISR revalidation, graceful try/catch fallbacks so a flaky API call doesn't break sitemap generation entirely.
- `robots.ts` correctly disallows all private/auth surfaces (`/studio`, `/settings`, `/messages`, auth pages) — this is exactly right and shows someone already thought about crawl budget and privacy.
- `FeedGrid.tsx` uses real windowed virtualization (`@tanstack/react-virtual`) plus HLS manifest preloading on the primary feed — above-baseline engineering for a list this central to the product.
- `Input.tsx` in the design system auto-wires `aria-invalid`/`aria-describedby` from a single `error` prop — a genuinely good, reusable a11y pattern (referenced by an internal `LOW-09` fix marker, indicating this was already deliberately hardened once).
- Zero hardcoded hex colors anywhere — full commitment to the CSS-variable token system.
- Login form has correct `htmlFor`/`id` label association and proper `disabled={loading}` double-submit protection.
- Admin dashboard's "unified triage queue" (merging approvals/reports/fraud into one severity-ranked list) is a thoughtful, non-generic UX decision — exactly the kind of product judgment the brief asks to be graded on.

---

## Scores

**Web UI score: 7/10** — Consistent design-token usage (zero hex drift), a real design system, and a strong watch/home experience; held back by inconsistent focus states on the shared `Button` primitive and no light theme as a deliberate, documented choice.

**Web UX score: 7/10** — Good loading-skeleton coverage on the consumer surface, working infinite-scroll virtualization, and solid error/empty states; hand-rolled form validation (no field-level real-time errors) and a large `'use client'` footprint on otherwise-static pages hold it back.

**Admin UI/UX score: 6.5/10** — The shared `DataTable` (loading/empty/selection/bulk-actions) and the dashboard's unified triage queue show real product thinking; dragged down by zero skeleton usage, one raw-`<table>` outlier, and thinner responsive coverage than web.

**Accessibility score: 5.5/10** — Genuine bright spots (`Input`'s auto-wired ARIA, the shell's skip-link, `DataTable`'s roving tabindex per prior audit) sit next to systemic gaps: near-absent `aria-label` coverage (10 files web, 1 admin) and no focus-visible treatment on the shared `Button`.

**SEO score: 6/10** — `sitemap.ts`/`robots.ts`/JSON-LD infrastructure exists and is well-built where applied (a real improvement over the platform's state in the prior 2026-07-22 audit, which found none of this present at all), but coverage is inconsistent: courses — a whole content vertical — are client-only, unindexed, and missing from the sitemap.

**Frontend performance score: 7/10** — Real virtualization on the primary feed, `next/font` self-hosted fonts, ISR on key pages (`revalidate` on home/explore/sitemap), and disciplined image handling (13 files use `next/image`, only 1 raw `<img>` total across both apps); missing `React.memo` on list rows and the course pages' unnecessary client-rendering are the main drags.
