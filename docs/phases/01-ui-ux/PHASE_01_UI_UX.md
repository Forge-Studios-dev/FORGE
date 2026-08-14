# Phase 01 — UI / UX (Fresh Master Execution Audit)

**Phase:** 01 — UI/UX  
**Date:** 2026-08-04  
**Status:** Analysis → Research → Audit → Docs → Roadmap → **Validated — awaiting approval to implement**  
**Source of truth:** Current codebase only (`apps/web`, `apps/admin`, `apps/mobile`, `packages/design-system`). Prior phase docs ignored for findings.

---

## 1. Objective

Bring FORGE’s viewer / creator / admin / mobile surfaces to **YouTube-parity interaction quality**: chrome modes, visual system consistency, modal/menu accessibility, feed/watch IA, and design-system adoption — without Phase 08 player rewrite or Phase 04–07 product feature builds.

---

## 2. Existing state (code-backed)

### 2.1 Surfaces

| Surface | Stack | Scale |
| --- | --- | --- |
| Consumer web | Next.js App Router | ~70 routes (auth, home, watch, shorts, studio, community, legal…) |
| Admin | Next.js | ~18 routes (dashboard, content, reports, live, fraud…) |
| Mobile | Flutter + GoRouter | Features: feed, shorts, watch, studio, live, community, library… |
| Design system | `@forge/design-system` | Tokens + ~22 React primitives (Button, Dialog, EmptyState, skeletons…) |

### 2.2 Design system

- Dual theme: dark default (`.dark` / `:root`), light via `.light` + `ThemeProvider` (`forge-theme` / `forge-admin-theme`).
- Material-style surface ladder + semantic status colors (`live`, `success`, `warning`, `critical`).
- Typography: Space Grotesk display + Inter body (`--font-display-forge`, `--font-body`).
- Spacing tokens: `--spacing-margin-mobile/desktop`, `--spacing-container-max: 1440px`.
- Hardcoded hex in app UI is rare (mostly confined to DS theme files + Chart).

### 2.3 Chrome architecture (web)

`AppShell` mode matrix (YouTube-aligned):

| Mode | Routes | Chrome |
| --- | --- | --- |
| Minimal | auth, offline, maintenance, embed… | No TopBar/SideNav |
| Shorts | `/shorts` | Full-bleed, no consumer chrome |
| Watch / Studio | `/watch/*`, `/studio/*` | TopBar only (masthead search/account) |
| Default | home, explore, library… | TopBar + SideNav + MobileNav + footer |

SideNav PRIMARY: Home, Shorts, Trending, Subscriptions, Explore, Live.  
SideNav YOU: You, History, Watch later, Liked + Studio CTA.

### 2.4 Home IA

- Guests: marketing `HeroSection` + rails + feed.
- Signed-in: feed-first (hero hidden); Live / Continue / Trending rails; **For you / Subscriptions** tabs; category chips.
- Server shell + client island (`HomeFeedTabs`) — good SSR split.

### 2.5 Watch / playback UX (present)

Rich watch chrome already exists: related rail, chapters, transcript, comments sort, end-screen, playlist queue, miniplayer, share-at-timestamp, report presets, Super Thanks UI hooks. Player is custom-wrapped HLS (`VideoPlayer` ~680 LOC) still built on native `<video>` controls patterns for base chrome — deeper player redesign is Phase 08.

### 2.6 Studio / Admin / Mobile

- Studio: dedicated `StudioShell` nav (Content, Analytics, Monetization, Audience, Settings).
- Admin: most pages use DS `PageHeader` / `StatusPill`; orphans remain on legacy LMS routes (`channel-points`, `mentorship`).
- Mobile: Material3 + `ForgePalette`; immersive routes for shorts/watch/live/rooms; bottom `NavigationBar` on shell routes.

---

## 3. Industry research (YouTube / peers → FORGE gaps)

| Pattern (YouTube / peers) | FORGE today | Gap |
| --- | --- | --- |
| Guest home = feed + sign-in prompts | Guest marketing hero card above feed | Product IA divergence |
| Masthead search on watch | TopBar on watch | Aligned |
| Guide (sidebar) collapsed on watch | No SideNav on watch | Aligned |
| Shorts immersive | No AppShell chrome | Aligned |
| Create (+) in bottom nav (mobile) | Studio as 5th tab when signed in | Crowding / wrong metaphor vs YouTube Create |
| Menus: focus trap, Esc, restore | `<details>` Create/Account; some Dialogs | Incomplete a11y |
| Custom player chrome | HLS + overlays; native-ish base | Phase 08 |
| Red brand accent | Purple MD3 primary | Brand ≠ YouTube; also conflicts with “avoid AI purple” taste guidance |
| Density: 16:9 cards, metadata rows | FeedCard grid/carousel/sidebar | Mostly aligned |
| Empty / loading skeletons | DS skeletons + root `loading.tsx` | Aligned on home; uneven elsewhere |
| Modal system single primitive | Dialog used on gates + SaveToPlaylist; CommunityWelcome still hand-rolled | Incomplete |

---

## 4. Audit findings (severity)

### Critical

_None for Phase 01 chrome scope_ — core browse/watch chrome is navigable and tokenized.

### High

| ID | Finding | Evidence |
| --- | --- | --- |
| H1 | Create + Account menus use `<details>` — weak focus management / Esc / outside-click vs DS Dialog | `TopBar.tsx` |
| H2 | `CommunityWelcomeModal` hand-rolled `fixed inset-0` dialog — no focus trap / restore | `CommunityWelcomeModal.tsx` |
| H3 | Mobile primary IA: Studio as 5th bottom tab vs YouTube Home/Shorts/Create/Subs/You | `MobileNav.tsx` + Flutter `MainScaffold` |
| H4 | Brand primary is MD3 purple; YouTube-replica consumers expect red/neutral video chrome | `theme-modes.css` |

### Medium

| ID | Finding | Evidence |
| --- | --- | --- |
| M1 | Guest hero is growth marketing, not YouTube feed-first | `HomeHero` / `HeroSection` |
| M2 | `CategoryFilter` `role="tablist"` without arrow-key / roving tabindex | `CategoryFilter.tsx` |
| M3 | Admin LMS leftover pages lack DS `PageHeader` | `admin/.../channel-points`, `mentorship` |
| M4 | Magic font sizes (`text-[10px]`) in nav chrome | SideNav, MobileNav, NotificationsMenu |
| M5 | Mobile Home vertical feed vs YouTube card grid | Product IA; large rewrite |
| M6 | Notifications menu is `<details>`-style pattern | `NotificationsMenu.tsx` |

### Low

| ID | Finding |
| --- | --- |
| L1 | `SkillChip` naming remnant in DS export alias `TopicChip` |
| L2 | `/blueprints` flag-gated design reference (OK if gated) |
| L3 | Shorts cinematic black/white hardcodes acceptable for immersion |
| L4 | Remaining sheets (shorts overflow) incremental Dialog migration |

---

## 5. Recommended architecture (Phase 01)

```
packages/design-system
  tokens (theme-modes) ──► web / admin Tailwind
  react/* primitives    ──► AppShell, Studio, Admin, gates
apps/web
  shell/ (TopBar, SideNav, MobileNav, menus)
  home/  (Hero policy, rails, tabs)
  watch/ (layout only; player chrome → Phase 08)
apps/admin
  PageHeader + Dialog on every operator page
apps/mobile
  MainScaffold IA + ForgePalette parity with web tokens
```

**Menu primitive strategy:** introduce a lightweight `Menu` / migrate Create + Account + Notifications to focus-safe popovers (DS Dialog for modal; popover Menu for compact menus). Prefer one shared pattern over more `<details>`.

**Brand strategy (decision required):**  
A) Keep FORGE purple as intentional brand differentiation, or  
B) Shift primary toward YouTube-like red/neutral for replica fidelity.  
Roadmap slice B1 is **token-only** if B is chosen; no layout churn.

---

## 6. UI / navigation / component hierarchy

### Consumer (default)

```
AppShell
├── TopBar (logo, SearchSuggest, theme, create, notify, account)
├── SideNav (PRIMARY | YOU | Studio)
├── main#main-content
│   └── page (HomePageContent | Library | …)
├── SiteFooter
└── MobileNav
MiniPlayerDock (global, when session)
```

### Watch / Studio

```
TopBar → page (WatchExperience | StudioShell → studio pages)
```

### Shorts

```
ShortsFeed (full viewport; no AppShell chrome)
```

### Design system hierarchy (target)

```
Icon, IconButton, Avatar
Button, Input, Tabs
Dialog, ConfirmDialog, Menu (new)
EmptyState, LoadingSkeleton*, StatusPill, LiveBadge
PageHeader, Card*, AlertStrip, PaywallCard
```

---

## 7. User flows (Phase 01 touchpoints)

1. **Guest land → browse → signup** — hero vs feed-first decision.
2. **Signed-in home → filter category → open watch** — chips + grid.
3. **Watch → leave → miniplayer → expand** — chrome + dock.
4. **Create menu → Upload / Short / Live** — must be keyboard-safe.
5. **Mobile tab switch** — Home / Shorts / Create|Studio / Subs / You.
6. **Community welcome** — dismissible accessible modal.

---

## 8. Edge cases

- Guest hitting Subs/Library → `guestHref` login redirect (present).
- Creator pending → Studio → waiting-approval (present).
- Miniplayer + MobileNav overlap on small screens (`bottom-20` vs `bottom-6`) — verify collision.
- Theme FOUC: layout blocking script + `readDomTheme` (present).
- Watch TopBar reduces vertical player space — intentional YouTube parity.

---

## 9. Risks

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Brand color flip alienates existing users | Med | Feature flag / staged token swap |
| Menu rewrite regresses Create CTA | Med | Snapshot tests + manual checklist |
| Scope creep into player / search / recs | High | Hard defer to later phases |
| Mobile IA change breaks muscle memory | Med | Keep 5 slots; only remap Create |

---

## 10. Database / API changes

**None for Phase 01.** UI-only. (Brand tokens, menus, admin chrome, mobile nav labels.)

---

## 11. Acceptance criteria (implementation gate)

1. Create + Account + Notifications menus: focus trap or roving focus, Esc closes, focus restores.
2. `CommunityWelcomeModal` uses DS `Dialog`.
3. Mobile bottom IA matches YouTube metaphor (Create entry, not “Studio” as primary tab label) **or** explicit product waiver documented.
4. Brand decision recorded; if red/neutral chosen, dark+light tokens updated + smoke on home/watch/studio.
5. Admin `channel-points` / `mentorship`: either DS PageHeader + retire CTA, or redirect to dashboard when LMS flag off.
6. CategoryFilter keyboard tabs (or defer explicitly to Phase 21 with waiver).
7. Manual checklist green on web + one mobile pass; no unrelated module edits.

---

## 12. Testing plan

- Unit: menu open/close + focus restore (if extracted hook).
- Integration: TopBar Create links render by permission flags.
- A11y: axe smoke on home, watch, library (existing CI paths).
- Manual: keyboard-only Create upload; Esc on Community welcome; mobile tab labels; theme toggle FOUC-free.

---

## 13. Optimization plan (post-implement)

- Avoid new client JS in home SSR path.
- Lazy-load menu panels only when opened.
- No new packages unless Menu cannot be done with DS Dialog + positioning.

---

## 14. Production checklist

- [ ] Tokens published via existing DS CSS import path
- [ ] No secrets / env changes
- [ ] Backward-compatible routes
- [ ] Docs + roadmap updated on close
- [ ] Phase report with readiness score
