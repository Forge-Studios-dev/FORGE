# FORGE — Full UI/UX spec for any AI design / codegen tool

Use this document to generate **complete** web and mobile UI in **any AI design or codegen tool** — including Google Stitch, v0 (Vercel), Lovable, Galileo AI, Uizard, Figma AI, Subframe, Bolt, as well as general-purpose LLMs like Claude, GPT, and Gemini. It maps to the real monorepo: **Next.js web** (`apps/web`), **Flutter mobile** (`apps/mobile`), **Admin** (`apps/admin`).

> **Tool-agnostic by design.** Anywhere you read "frame", "screen", or "artifact", substitute the unit your AI tool produces (Stitch frame, v0 component, Lovable page, Figma node, code file, etc.). The rules and content are identical across tools.

**Coverage guarantee (what this doc includes)**

| Layer | Covered |
|-------|---------|
| **Roles** | **Admin**, **Creator**, **User (Viewer)** + **Guest** — full role matrix in **§1.2**; role-aware artifacts marked across **§3 / §4 / §5 / §10** |
| **Web routes (User + Creator)** | Shell, `/`, `/watch/[id]`, `/[username]`, `/upload`, `/login`, `/signup`, `/waiting-approval`, `/approval-rejected`, `/notifications`, `/playlists/new`, `/playlists/[id]`, `/search`, **`/studio`** (Creator dashboard) |
| **Mobile routes (User + Creator)** | Shell, `/feed`, `/explore`, `/live`, `/watch/:id`, `/profile/:username`, `/login`, `/signup`, upload flow, **`/studio`** (Creator) |
| **Admin** | Dashboard, users, creator-approvals, content, categories, reports |
| **Components** | Full library **§2.8** (navigation, inputs, feedback, media, data, overlays) |
| **States** | **Positive** (happy path, success) + **negative** (empty, error, loading, denied, offline, validation, unavailable) + **role-denied** — **§10** master catalog + **§11** prompt |
| **Visual identity** | **§1.1** — modern / futuristic; **not** a YouTube visual replica (IA familiarity only) |

**How to use with any AI tool**

1. Paste **§1–1.2** (identity + **anti-clone / modern–futuristic direction** + **3-role matrix**) then **§2** (design system + **§2.8 component library**) as the AI's system / project context.
2. For **every screen**, generate artifacts for: **default/success**, **loading**, **empty**, **error**, **permission / edge**, and **role variants** (Guest / User / Creator / Admin) where **§10** marks them required.
3. Generate **Web shell** → web screens (User → Creator-only) → **Mobile shell** → mobile screens → **Admin** (separate visual theme).
4. Use **§11 Master AI prompt** (single paste, tool-agnostic) or split by §3 / §4 / §5 / §10 if your AI has shorter context windows.
5. Naming: `Web / Home — User — Success`, `Web / Home — Guest — Empty`, `Web / Studio — Creator — Success`, `Admin / Approvals — Empty`, etc.

**Tool-specific adapter tips (optional)**

| AI tool | How to use this doc |
|---------|---------------------|
| **Google Stitch** | Paste §1–§2 as system, §11 as project prompt; generate frames per §10. |
| **v0 (Vercel)** | Paste §1.1, §1.2, §2.7, §2.8 + one route at a time from §3 / §10. Ask for `apps/web` Next.js + Tailwind output. |
| **Lovable / Bolt** | Paste §11 + targeted route block. Request full Next.js routes with shared design tokens from §2.2. |
| **Galileo / Uizard** | Use §1.1 + §2 as style brief, §10 catalog to drive screen generation. |
| **Figma AI / Subframe** | Use §2.7–§2.8 as the component library brief, §10 as the screen list. |
| **Claude / GPT / Gemini** | Paste whole doc as system prompt; ask for screens/components/state variants per §10. |

---

## 1. Product identity (always prepend)

**FORGE** is a **skill-first creator learning platform**: tutorials, live teaching, expertise tags, and audience growth.

**YouTube = mental model only (information architecture), not a visual template.**
Users should *understand* the product quickly because patterns resemble mainstream video apps (home feed, watch page, channel, search, upload). **Do not** produce a **complete replica** or **near-copy** of YouTube's layout, typography, colors, icons, or component shapes. FORGE must look **distinctly its own**: **modern, refined, and optionally futuristic** — appropriate for a **learning + expertise** brand, not a generic gray-red video portal.

**Never confuse with:** generic TikTok clone only, or Netflix-only VOD.

---

## 1.1 Visual direction — modern & futuristic (anti-clone)

**Every AI tool must follow this.** If output looks like YouTube with a different logo, **reject and regenerate**.

| Do | Don't |
|----|--------|
| **Modern** — clean geometry, confident spacing, contemporary type (consider distinctive display font for "FORGE" + readable UI font) | YouTube's exact sidebar width, hamburger placement clone, or signature red/white/gray combo as default |
| **Futuristic (tasteful)** — subtle glass or soft blur on chrome, gentle gradient accents, **accent glow** on LIVE and CTAs, optional mesh/noise texture *lightly* | Cyberpunk overload, neon clutter, illegible "sci-fi" type |
| **Skill-forward UI** — chips, learning cues, "paths" visual language feel **crafted** | Generic entertainment-only feed with no learning identity |
| **Ownable player chrome** — custom control bar shape, scrubber styling, FORGE-branded progress | Pixel-identical YouTube player controls |
| **Navigation** — same *concepts* (home, discover, live, you) with **different composition** (e.g. bottom sheet patterns, pill nav, command palette optional) | Copy-paste YouTube desktop left rail + top bar layout |

**Aesthetic keywords for prompts:** *refined, editorial, calm confidence, glass-light, depth without noise, skill-native, premium learning product, 2025+ product design* — **not** "clone YouTube UI".

**One-liner to repeat in every AI session:**
*"Information architecture inspired by familiar video apps; visual design is original, modern, and slightly futuristic — FORGE brand, not a YouTube skin."*

---

## 1.2 User roles — Admin, Creator, User (Viewer)

FORGE ships **three first-class roles** plus an unauthenticated **Guest**. Every screen, component, and artifact in this document must respect this role model. **The AI must generate role-specific variants** wherever the table below marks them.

### 1.2.1 Role definitions

| Role | App surface | Identity in UI |
|------|-------------|----------------|
| **Guest** | `apps/web` + `apps/mobile` (read-only) | TopBar shows **Sign in / Sign up**; no avatar |
| **User (Viewer)** | `apps/web` + `apps/mobile` | Avatar menu shows **Profile, Settings, Become a creator, Sign out**; no Studio link |
| **Creator** | `apps/web` + `apps/mobile` (same shell as User + Studio surface) | Avatar menu adds **Studio** + **Upload**; subtle "Creator" badge on own channel |
| **Admin** | `apps/admin` only (separate, dense theme) | Admin shell — sidebar with operational sections; never uses consumer chrome |

> **Important:** Admin is a **separate app** with its own theme. Users and Creators share the consumer shell — the difference is **gated surfaces** (Studio, Upload, Live broadcast), not a different visual language.

### 1.2.2 Capability matrix (drives gating UI)

| Capability | Guest | User | Creator | Admin |
|------------|:-----:|:----:|:-------:|:-----:|
| Browse feed / watch public videos | ✓ | ✓ | ✓ | ✓ |
| Search videos & creators | ✓ | ✓ | ✓ | ✓ |
| Follow / Like / Save / Comment | — (gate) | ✓ | ✓ | ✓ (as user) |
| Create playlists | — | ✓ | ✓ | — |
| Request to become Creator | — | ✓ | n/a | n/a |
| **Upload video** | — (gate) | — (gate: "Become a creator") | ✓ | — |
| **Go Live** | — | — | ✓ | — |
| Manage own videos (edit, delete, visibility) | — | — | ✓ | ✓ (moderation) |
| **Studio / Creator dashboard** | — | — | ✓ | — |
| View basic analytics on own content | — | — | ✓ | ✓ (platform-wide) |
| Approve / reject creators | — | — | — | ✓ |
| Moderate content / take down videos | — | — | — | ✓ |
| Manage categories / taxonomy | — | — | — | ✓ |
| Handle user reports | — | — | — | ✓ |
| Impersonate / audit users | — | — | — | ✓ |

### 1.2.3 Role-driven UI rules (apply everywhere)

| Rule | Behavior |
|------|----------|
| **Gate, never hide silently** | Show the affordance (Upload, Follow, Comment) and open **AuthGateModal** or a role-upgrade screen when tapped. Exception: Admin-only routes are not exposed in consumer shell at all. |
| **Avatar menu varies by role** | Guest → Sign in / Sign up. User → adds **Become a creator**. Creator → adds **Studio**, **Upload**. Admin → consumer app does not surface admin nav; admins enter via `apps/admin`. |
| **Own vs other channel** | Visiting `/[username]` while logged in as the channel owner shows **Edit channel**, **Studio**, and **Upload** CTAs replacing **Follow**. |
| **Pending / rejected creator** | A User who requested Creator stays in the **User** capability set but Upload routes redirect to `/waiting-approval` or `/approval-rejected` instead of the gate. |
| **Admin theme isolation** | Never blend admin components into consumer screens; never use the consumer purple/glow accent inside `apps/admin` table chrome. |

### 1.2.4 Required role variants (summary)

Generate at minimum these role variants per surface. Detailed lists live in **§10**.

| Surface | Variants to generate |
|---------|----------------------|
| Web/Mobile **Shell (TopBar + Nav)** | Guest, User, Creator |
| Web/Mobile **Home / Feed** | Guest, User, Creator (Creator sees "Your latest upload" strip optionally) |
| Web/Mobile **Watch** | Guest (comment gated), User, Creator (adds "Edit video" if owner) |
| Web/Mobile **Channel `/[username]`** | Visitor view, Owner view (Creator's own channel) |
| Web/Mobile **Upload** | User (gate: Become a creator), Pending, Rejected, Creator (full wizard) |
| Web/Mobile **Studio `/studio`** | Creator only (positive + empty + error) — **does not exist** for Users / Guests |
| Admin | Admin only — full set in **§5** + **§10.4** |

---

## 2. Global design system

### 2.1 Modes

| Mode | Use |
|------|-----|
| **Browse** | Light or soft-dark surfaces; high readability for feed and search |
| **Watch** | Dark cinema chrome around player; optional dimmed peripheral UI |
| **Creator / Upload** | Neutral, focused; minimal distraction |

Ship **light + dark** themes with one shared accent color.

### 2.2 Color tokens (suggested names)

| Token | Role |
|-------|------|
| `--bg-app` | Page background |
| `--bg-elevated` | Cards, panels |
| `--bg-muted` | Chips, secondary surfaces |
| `--text-primary` | Headlines, titles |
| `--text-secondary` | Meta, timestamps, channel names |
| `--text-tertiary` | Hints, captions |
| `--border-subtle` | Hairline dividers |
| `--accent` | Primary CTA, progress, focus ring |
| `--accent-muted` | Hover background for accent |
| `--live` | Live badge (e.g. red or brand red) |
| `--success` / `--warning` / `--error` | Status, forms, errors |

### 2.3 Typography scale

| Level | Usage |
|-------|--------|
| **Display** | Marketing hero (optional) |
| **H1** | Page title, video title (watch) |
| **H2** | Section headers ("Up next", "Your skills") |
| **Body** | Descriptions, comments |
| **Label** | Buttons, chips, tab labels |
| **Meta** | View count, time ago, duration — small but **4.5:1** contrast minimum |

**Rule:** Video title on watch page **never below 18px** effective on mobile web.

### 2.4 Spacing & radius

- Base unit **4px**; card padding **12–16** mobile, **16–24** desktop.
- Card radius **12–16px**; buttons **full** or **8px**; player container **8–12px** when not fullscreen.

### 2.5 Elevation

- Rest: subtle shadow or border only.
- Hover (web): lift + shadow **or** border accent.
- Sticky headers: `--bg-elevated` + blur optional.

### 2.6 Iconography

- Outline icons, **24px** default, **20px** dense.
- Set: Home, Search, Live (broadcast), Create/Upload, Notifications, Profile, Menu, Like, Share, Save/bookmark, More (⋯), Settings, Report.

### 2.7 Core components (build once, reuse everywhere)

| Component | Behavior |
|-----------|----------|
| **TopBar** | Logo, Search field (expandable on mobile), icons (create, notifications, avatar menu) — **3 role variants:** Guest / User / Creator |
| **SideNav** (web md+) | Home, Explore, Live, Library (playlists/history placeholder), Subscriptions placeholder; **Creator adds:** Studio, Upload shortcut |
| **BottomNav** (mobile) | Home, Explore, Live, Create (center FAB optional), Profile; **Creator:** center FAB opens upload directly; **User:** center FAB opens AuthGate or "Become a creator" gate |
| **VideoCard** | Thumbnail 16:9, duration badge bottom-right, title 2 lines max, channel + avatar, meta row (views · time), **skill chips** (max 2 visible + overflow) |
| **ChannelRow** | Avatar 36–40px, name, subscribe/follow button, subscriber count optional |
| **SkillChip** | Small pill; removable in filters |
| **SegmentedControl** | Latest / Popular / For you (logged-in) |
| **EmptyState** | Illustration + headline + one primary CTA |
| **Skeleton** | Card-shaped shimmer blocks matching VideoCard |
| **Toast** | Success / error; bottom mobile, top-right desktop optional |
| **InlineAlert** | Dismissible banner: info / warning / error (used under TopBar) |
| **AuthGateModal** | Title, body, Sign in + Cancel for gated actions (used for Guest hitting Follow/Comment/Upload) |
| **RoleUpgradeGate** | Variant of gate: "Become a creator to upload" → primary CTA opens creator-request flow; secondary "Maybe later" |
| **ConfirmDialog** | Destructive neutral title, Cancel / Confirm |
| **CreatorBadge** | Small pill / icon shown next to display name on Creator's own avatar menu, channel header, and comment rows |
| **Pagination** | Prev/next or numbered for tables |
| **Breadcrumbs** | Admin + deep web optional |

### 2.8 Complete component library (generate as a reusable set)

Design **all** of these so tokens stay consistent across the app.

**Navigation & shell**

- Logo lockup, TopBar (guest vs logged-in), SideNav (expanded / collapsed icon rail), Mobile drawer menu
- BottomNav (mobile): 4 tabs + optional center FAB
- TabBar under channel header (Videos | Live | About)
- SegmentedControl (Latest | Popular | For you)
- SearchField with clear button + optional voice icon (mobile optional)

**Inputs & forms**

- TextField (default, error with message below, disabled, read-only)
- PasswordField with show/hide toggle
- TextArea with character hint optional
- Select / dropdown (visibility, category)
- Multi-select skill picker as searchable chip field
- Checkbox (terms), Switch (notifications placeholder)
- DateTime picker (schedule publish)
- Primary / Secondary / Ghost / Destructive buttons
- Drag-drop upload zone + file row with remove

**Lists & cards**

- VideoCard (default, **hover**, focus ring web)
- **LiveCard** (LIVE pulse, viewer count)
- CreatorCard horizontal (search results)
- NotificationRow (icon by type, unread dot)
- PlaylistRow (drag handle placeholder, duration sum optional)
- CommentRow (avatar, text, time, More menu — placeholder depth)

**Feedback**

- Spinner (inline button, page center)
- Skeleton: VideoCard grid, text lines, player rectangle
- EmptyState illustration + headline + CTA + secondary link
- ErrorState illustration + message + Retry + "Go home"
- Toast success / error
- InlineAlert sticky
- ProgressBar linear (upload), circular optional (processing)

**Overlays**

- Modal (center), Drawer (mobile filters), BottomSheet (mobile watch metadata)
- Tooltip (icon buttons web)

**Special**

- Player chrome (play, pause, seek, volume, fullscreen, settings, LIVE badge overlay)
- Duration badge on thumb; **processing** badge "Processing" on card
- SkillChip + CategoryChip + overflow "+N"
- Avatar sm/md/lg + verified badge placeholder optional
- Divider, SectionHeader ("Continue watching", "Live now")

### 2.9 Positive vs negative (definitions)

| Term | Meaning |
|------|---------|
| **Positive** | Happy path: data present, action succeeds, user permitted |
| **Negative** | Empty lists, API/load failure, validation errors, **auth/creator denied**, unavailable content, offline, processing failure |
| **Edge** | Boundary cases: single item list, very long title, slow connection (skeleton linger) |

**Rule:** Every **list-based screen** needs at minimum **Positive**, **Loading (skeleton)**, **Empty**, **Error**. Forms need **Valid submit**, **Validation errors**, **Submit loading**. **Watch** needs **Playing**, **Processing**, **Failed/unavailable**.

---

## 3. Web application — screen-by-screen

**Stack:** Next.js 14 App Router, Tailwind. **Breakpoints:** mobile `<768`, tablet `768–1024`, desktop `>1024`.

**Positive / negative artifacts:** Layout and features below describe **structure**; the authoritative **which artifacts to generate per route** list is **§10.2** (always cross-check before export).

### 3.1 Global shell (all authenticated / public browse)

**Layout**

- **Desktop:** Fixed **TopBar** + optional **SideNav** (240px) + **main** scroll region.
- **Tablet:** Collapsible nav (hamburger) + TopBar.
- **Mobile:** TopBar + bottom optional shortcuts OR rely on hamburger only — **match output to one pattern consistently**.

**TopBar**

- Left: FORGE logo → `/`
- Center: **Search** — full width on mobile (icon opens overlay); desktop wide field with placeholder "Search skills, creators, videos"
- Right: **Create** (upload) icon → `/upload` (auth gate if guest), **Notifications** bell → `/notifications`, **Avatar** menu (Profile, Settings, Sign out / Sign in)

**Avatar menu — role variants (generate all three)**

| Role | Menu items (top → bottom) |
|------|---------------------------|
| **Guest** | **Sign in** → `/login`, **Sign up** → `/signup` |
| **User (Viewer)** | View channel (`/[username]`), My playlists, **Become a creator** (opens creator-request modal/screen), Settings, Sign out |
| **Creator** | View channel (`/[username]`), **Studio** → `/studio`, **Upload** → `/upload`, My playlists, Settings, Sign out — with **CreatorBadge** next to display name |

**Create (TopBar) icon behavior by role**

- Guest tap → **AuthGateModal** "Sign in to continue".
- User tap → **RoleUpgradeGate** "Become a creator to upload".
- Pending / Rejected User tap → redirect to `/waiting-approval` or `/approval-rejected`.
- Creator tap → `/upload` directly.

---

### 3.2 Route: `/` — Home

**Purpose:** Primary discovery; skill-aware feed.

**Sections (top → bottom)**

1. **Category strip** — Horizontal scroll chips: All + taxonomy categories (from API). Selected state clearly indicated.
2. **Continue watching** (logged-in, if API returns items) — Horizontal carousel of VideoCards with progress bar on thumb.
3. **Live now** (if streams exist) — Compact horizontal strip: LIVE badge, title, creator, viewer pill.
4. **Feed header** — Segmented: **Latest** | **Popular** | **For you** (only if logged in; hide For you for guests).
5. **Video grid** — Responsive columns: 1 (mobile), 2 (tablet), 3–4 (desktop). Infinite scroll sentinel at bottom.

**Features**

- Pull URL query `?category=` sync with chip selection.
- Feed meta: show cursor loading at bottom (subtle).

**States**

- **Loading:** Skeleton grid 8–12 cards.
- **Empty:** "No videos in this category yet" + CTA "Explore all" or "Browse live".
- **Error:** Banner "Couldn't load feed" + Retry.
- **Guest:** For you tab disabled or prompts sign-in on click.

**Prompt keywords:** Modern responsive **video discovery** grid (original layout — **not** a YouTube clone), FORGE skill chips, horizontal category row, continue-watching rail, live strip, futuristic-tasteful chrome.

---

### 3.3 Route: `/watch/[id]` — Watch

**Purpose:** VOD playback and engagement.

**Layout**

- **Desktop:** Two-column — Main **70%**: player + primary info; **Sidebar 30%**: related videos list + optional mini comments.
- **Mobile:** Single column — player sticky top; scroll metadata below.

**Player area**

- 16:9 container; letterboxing if needed.
- Controls: play/pause, seek, volume, fullscreen, settings gear (quality if multi-bitrate), **theater mode** optional (wide player).
- **Processing state:** If video not ready, show poster + "Processing…" progress messaging.

**Primary metadata block**

- **Title** (H1, 2 lines clamp expandable "Show more")
- **Stats row:** views, published date, **skill chips** (link to `/?category=` or search)
- **Channel row:** avatar, display name → `/[username]`, **Follow** button (auth), subscriber count optional
- **Engagement row:** Like, Dislike or "Not interested" optional, **Share**, **Save** (playlist future), **More** (Report, Save to playlist)

**Secondary**

- **Description** collapsible
- **Comments** section — threaded list placeholder; composer at bottom (auth-gated): "Add a comment…"

**Sidebar / below fold**

- **Related videos** — VideoCard list (same creator or similar skills first if reflected in UI copy)

**States**

- Loading player: skeleton + spinner in player.
- Geo/restriction: message placeholder.
- Deleted/private: error state "Video unavailable".

---

### 3.4 Route: `/[username]` — Channel (public profile)

**Purpose:** Creator hub; videos and identity.

**Header**

- **Banner** image (16:9 crop), gradient scrim bottom for text legibility.
- **Avatar** overlapping banner bottom-left.
- **Display name**, **@username**, **Follow** + bell notifications optional.
- **Bio** 2–4 lines; **skill badges** row (prominent FORGE differentiator).
- **Stats:** subscribers, video count (if shown).

**Tabs**

- **Videos** (default) — Grid same as home VideoCard.
- **Live** — Upcoming / past live placeholders or list from API.
- **About** — Long bio, links, join date.

**States**

- Not found: 404-style illustration.
- Own channel: **Edit channel** CTA (settings future).

---

### 3.5 Route: `/upload` — Upload & publish (**Creator only**)

**Purpose:** Creator upload flow. **Role-gated** — non-creators see different surfaces (see role gates below).

**Recommended steps (wizard) — Creator path**

1. **Select source** — Drag-drop zone + "Select file"; show max size, formats (mp4, mov).
2. **Details** — Title (required), description, **skill tags** multi-select/chips, **visibility** (public / unlisted / private), **schedule publish** datetime optional.
3. **Upload progress** — Progress bar, speed, cancel; after upload **Processing** state with link to video detail when ready.

**Features**

- Draft save optional (future).
- Clear **failure** message with retry for upload.

**Role gates (each is a distinct artifact)**

| Visitor | Artifact |
|---------|----------|
| **Guest** | `Web / Upload — Guest gate` — AuthGateModal full-screen variant; primary **Sign in**, secondary **Sign up** |
| **User (no creator request)** | `Web / Upload — Become a creator` — RoleUpgradeGate with value-prop bullets + primary **Apply to be a creator** |
| **User (pending)** | `Web / Upload — Pending` — redirect to `/waiting-approval` content inline |
| **User (rejected)** | `Web / Upload — Rejected` — redirect to `/approval-rejected` content inline |
| **Creator** | Full wizard (Success, Loading, File invalid, Too large, Network error, Processing) |

**Success:** toast + navigate to `/watch/[id]` when ready or show "Processing".

---

### 3.6 Route: `/login` — Sign in

**Fields:** Email, password, **Forgot password** link (UI even if flow partial).
**Actions:** Sign in (primary), **Continue with Google** placeholder if OAuth planned.
**Footer:** "New to FORGE?" → `/signup`.

**States:** Invalid credentials inline error; loading on submit.

---

### 3.7 Route: `/signup` — Sign up

**Fields:** Email, password, confirm password, display name, username.
**Legal:** Checkbox Terms + Privacy.
**Primary:** Create account; **Secondary:** `/login`.

---

### 3.8 Route: `/waiting-approval` — Creator pending

**Purpose:** User requested creator; admin not yet approved.

**UI:** Centered illustration, headline "Application under review", body copy, **Browse** CTA to `/`.

---

### 3.9 Route: `/approval-rejected` — Creator rejected

**Purpose:** Admin rejected creator request.

**UI:** Respectful message, optional note area, CTA **Contact support** or **Back home**.

---

### 3.10 Route: `/notifications`

**Purpose:** In-app notification list.

**Layout:** Page title "Notifications"; list rows (avatar/icon, text, time); **Mark all read** optional.
**Empty:** "No notifications yet".
**Types:** video ready, live started, comment (visual distinction by icon).

---

### 3.11 Route: `/playlists/new` — Create playlist

**Fields:** Title, description optional, visibility.
**Primary:** Create; redirect to playlist detail.

---

### 3.12 Route: `/playlists/[id]` — Playlist detail

**Purpose:** Ordered list of videos + playlist meta.

**UI:** Title, owner link, video list reorder placeholder (future), **Play all** primary.

---

### 3.13 Route: `/search` (recommended — add if not in repo)

**Purpose:** Dedicated search results (API: `/search?q=` + `/search/suggestions?q=`).

**Layout**

- Sticky search bar with clear button.
- **Tabs:** Videos | Creators (or unified ranked list with section headers).
- Results as VideoCard / horizontal creator cards (avatar, name, followers).

**States:** Empty query; no results "Try different keywords"; loading skeleton list.

---

### 3.14 Route: `/studio` — Creator dashboard (**Creator only**)

**Purpose:** Single hub for a Creator to manage their content, see basic performance, and start uploads / live streams. **This screen does not exist for Users / Guests** — direct navigation redirects to the RoleUpgradeGate.

**Layout (desktop)**

- Two-column inside main: left **vertical sub-nav** (Overview, Videos, Live, Comments, Analytics, Settings), right content pane.
- Mobile: top **SegmentedControl** mirrors sub-nav; content stacks below.

**Sub-sections**

| Section | Content |
|---------|---------|
| **Overview** | KPI strip (views last 7d, new followers, watch time, pending comments), **Recent uploads** list, **Quick actions** (Upload, Go live) |
| **Videos** | Table-like list of own videos: thumbnail, title, visibility, status (Published / Processing / Failed / Draft), views, published date, row actions (Edit, Delete, Change visibility) |
| **Live** | Upcoming + past streams; **Go live** primary CTA; empty state if none |
| **Comments** | Latest comments on own videos with quick reply / report |
| **Analytics** | Simple charts placeholder (views over time, top videos, top skills) |
| **Settings** | Channel banner, bio, skills, links (mirrors public channel edit) |

**States**

- **Empty Overview** — Creator just approved, no uploads yet: illustration + **Upload your first video** primary CTA.
- **Loading** — Skeleton KPI cards + table rows.
- **Error** — Load failure + Retry.
- **Role-denied** — `/studio` opened by User → RoleUpgradeGate; by Guest → AuthGateModal.

---

## 4. Mobile application (Flutter) — screen-by-screen

**Shell:** `MainScaffold` wraps **Feed, Explore, Live, Profile** tab routes; **Watch** and **Profile(username)** full-screen pushes.

**Positive / negative artifacts:** See **§10.3** for required variants per mobile route.

### 4.1 Bottom navigation (tab shell)

| Tab | Route | Icon |
|-----|-------|------|
| Home | `/feed` | Home |
| Explore | `/explore` | Compass / Search |
| Live | `/live` | Broadcast |
| Profile | `/profile/me` or avatar opens `/profile/:username` | Person |

**Optional FAB:** Center **Create** → upload flow (same as web mentally). **Role behavior:** Guest → AuthGateModal; User → RoleUpgradeGate "Become a creator"; Creator → opens upload flow directly.

**Tab visibility by role**

| Tab | Guest | User | Creator |
|-----|:-----:|:----:|:-------:|
| Home / Explore / Live | ✓ | ✓ | ✓ |
| Profile | Tap → Sign in | ✓ | ✓ + **Studio** entry inside Profile |

---

### 4.2 `/feed` — Home feed

Same content sections as web **§3.2** but single column VideoCards; category chips sticky below TopBar; pull-to-refresh.

---

### 4.3 `/explore` — Explore

**Purpose:** Discovery beyond default feed — trending, categories grid, or search entry.

**UI:** Search bar top; category grid **or** tab Latest / Popular; infinite list.

---

### 4.4 `/live` — Live hub

**Purpose:** Discover live streams now.

**UI:** List or carousel of live cards (thumbnail if available, LIVE pulse, title, creator, viewers).
**Empty:** "No live streams right now" + CTA Browse feed.

---

### 4.5 `/watch/:id` — Watch

Fullscreen-capable player; swipe-up **bottom sheet** for title, channel, actions; related below sheet or separate tab.

**Gestures:** Double-tap seek optional (show in spec as optional).

---

### 4.6 `/profile/:username` — Profile / channel

Mirror web **§3.4** with mobile tabs (Videos | Live | About).

---

### 4.7 `/login` & `/signup`

Mirror web forms; biometric placeholder optional **not** required for MVP spec.

---

### 4.8 Upload flow (mobile) — **Creator only**

Multi-step full-screen: pick video → details → upload progress — align copy with web **§3.5**. **Role gates** identical to web: Guest → AuthGateModal; User → RoleUpgradeGate; Pending/Rejected → redirect screens; Creator → full wizard.

---

### 4.9 `/studio` — Creator dashboard (mobile, **Creator only**)

Mobile-condensed mirror of web **§3.14**: top **SegmentedControl** (Overview | Videos | Live | Comments | Analytics), large primary **Upload** + **Go live** buttons in Overview; list-style rows for Videos and Comments. Same role-denied behavior — Users hitting `/studio` see RoleUpgradeGate as a bottom-sheet.

---

## 5. Admin application (`apps/admin`) — utility UI (**Admin role only**)

**Audience:** Platform administrators only. **Not accessible to Users or Creators.** Login enforces `role = admin`; non-admin sessions hitting any admin URL get **403 / role-denied** screen with a link back to consumer app.

**Tone:** Dense, professional, low decoration — **not** consumer YouTube-like. Different theme from User/Creator app (neutral palette, table-first, minimal motion).

**Admin shell**

- Left **SideNav** (fixed): Dashboard, Users, Creator approvals, Content, Categories, Reports, Settings
- Top utility bar: environment badge (Prod/Stage), search, admin avatar (name + role pill **ADMIN**), Sign out
- Breadcrumbs above content area

**Positive / negative artifacts:** See **§10.4**.

| Screen | Purpose |
|--------|---------|
| **Dashboard** | KPI cards (total users, creators pending, videos in review, open reports), quick links |
| **Users** | Search/filter users table — columns: name, email, role (User/Creator/Admin), status, joined; row actions: view, suspend, change role |
| **Creator approvals** | Pending queue: applicant card (name, bio, skills, requested at) + **Approve** / **Reject (with reason)** |
| **Content** | Videos table — title, creator, status, visibility, reports count; actions: view, take down, restore |
| **Categories** | Taxonomy CRUD — name, slug, parent, video count; create / edit / delete with confirm |
| **Reports** | User reports inbox — reporter, target, reason, status (Open / Resolved / Dismissed); row → detail drawer with actions |

**Components:** Data tables, badges (role / status), modal confirm, toast, drawer for detail panes, filter bar with chips.

**Role-denied artifact:** `Admin / 403 — Not authorized` — generated once; reused for any non-admin hitting admin URLs.

---

## 6. Cross-cutting UX rules

| Topic | Rule |
|-------|------|
| **Auth gate (Guest)** | Modal or full page "Sign in to continue" for Follow, For you, Upload, Comment. |
| **Role gate (User → Creator)** | RoleUpgradeGate for Upload, Go live, Studio access. Always present a clear path: **Apply to be a creator**. |
| **Pending / Rejected** | Show dedicated screens (`/waiting-approval`, `/approval-rejected`) instead of generic error when blocked by creator status. |
| **Admin isolation** | Admin app never imports consumer chrome; consumer apps never expose admin links in nav. |
| **Live vs VOD** | LIVE always **red/accent pulse** + "LIVE" label; never reuse for VOD. |
| **Skills** | At least one visible chip on every VideoCard and channel header. |
| **Accessibility** | Focus order logical; contrast AA; reduced-motion variant reduce parallax. |
| **RTL** | Optional phase-2; design symmetric layouts where possible. |

---

## 7. User flows (for flow diagrams)

**By role:**

**Guest**
1. Land on Home → tap Follow / Upload / Comment → **AuthGateModal** → `/login` or `/signup` → back to action.

**User (Viewer)**
1. **Discover → Watch:** Home → tap card → watch → related → new watch.
2. **Search → Watch:** Search → result tap → watch.
3. **Follow creator:** Channel → Follow → optional notification.
4. **Become Creator:** Avatar → Become a creator → request form → `/waiting-approval` → (admin approves) → Creator capabilities unlocked.

**Creator** (User flows + the following)
5. **Upload:** Studio or TopBar Create → wizard → processing → watch when ready.
6. **Manage content:** `/studio` → Videos → edit / change visibility / delete.
7. **Go live:** `/studio` → Live → Go live (placeholder for MVP).

**Admin**
8. **Creator approval queue:** Admin login → Approvals → review applicant → Approve / Reject (reason).
9. **Moderate content:** Reports inbox → open report → review video → take down / dismiss.
10. **Manage taxonomy:** Categories → create / edit / delete with confirm.

**Negative paths (must have UI coverage)**

- Feed load fails → Retry; offline → banner + cached empty optional
- Watch unavailable → error; guest tries comment → AuthGateModal
- **User tries upload** → RoleUpgradeGate "Become a creator"
- **Pending User** tries upload → `/waiting-approval` redirect
- **Rejected User** tries upload → `/approval-rejected` redirect
- Upload fails mid-flight (Creator) → Retry
- Login wrong password → inline error; session expires mid-session → banner
- Search no hits → empty results frame
- Admin destructive action → confirm modal
- Non-admin hits admin URL → `Admin / 403 — Not authorized`

---

## 8. Deliverables checklist (per export from any AI tool)

For each screen:

- [ ] Artifact name = route + **role** + state (e.g. `Web / Home — User — Success`, `Web / Home — Guest — Empty`, `Web / Studio — Creator — Empty`, `Admin / Approvals — Empty`)
- [ ] Light + dark variant **or** note "dark watch only"
- [ ] **Positive** artifact (happy path) per applicable role
- [ ] **Loading** skeleton artifact where lists/player/data fetch apply
- [ ] **Empty** artifact where lists can be empty
- [ ] **Error** artifact with Retry where network/API failure applies
- [ ] **Negative permission** artifacts where §10 requires (Guest AuthGate, User RoleUpgradeGate, Pending, Rejected, Admin 403)
- [ ] **Role variants** generated for Shell, Home/Feed, Watch, Channel, Upload (per **§1.2.4**)
- [ ] **Admin** screens generated only inside admin theme — never mixed into consumer flows
- [ ] Component names match **§2.7–2.8**
- [ ] Spacing token labels on one reference artifact
- [ ] **Anti-clone check** (**§1.1**): output does not look like a YouTube visual clone; layout/typography/color feel **modern / FORGE-distinct**

---

## 9. Out of scope (do not generate unless prototyping)

- Payments, tipping, memberships
- In-app DM chat
- Kids / COPPA mode
- Full studio analytics dashboard (consumer app)

---

## 10. Positive & negative artifacts — master catalog

Use this table so **no screen ships without explicit positive + negative UI**.
Mark **Artifact** = generate a separate screen/file/frame with that name pattern.

### 10.1 Global / shell

| Artifact | Positive | Negative / edge |
|----------|----------|------------------|
| **TopBar — Guest** | Logo, search, Sign in, Sign up | — |
| **TopBar — User** | Logo, search, Create, Notifications (with badge count), Avatar menu (with **Become a creator** entry) | Notifications **empty badge** (0) |
| **TopBar — Creator** | Logo, search, Create (direct to upload), Notifications, Avatar menu (with **Studio**, **Upload**, **CreatorBadge**) | — |
| **SideNav — Desktop (User)** | All consumer links visible, active state | Collapsed icon-only variant |
| **SideNav — Desktop (Creator)** | Consumer links + **Studio** + Upload shortcut | Collapsed icon-only variant |
| **Admin SideNav** | Dashboard, Users, Approvals, Content, Categories, Reports, Settings | Active state per route |
| **Mobile menu drawer — Guest / User / Creator** | Full link list per role | Same + Sign out at bottom |
| **AuthGateModal** (Guest) | — | Title "Sign in to continue", Sign in / Cancel |
| **RoleUpgradeGate** (User) | — | Title "Become a creator", value props, Apply / Maybe later |
| **Admin 403 — Not authorized** | — | Lock illustration + "Return to FORGE" link |
| **Session expired banner** | — | "Session expired" + Sign in again |
| **Offline banner** | — | "You're offline" sticky under TopBar |
| **Rate limit / maintenance** | — | InlineAlert "Try again later" |

### 10.2 Web — consumer (User + Creator)

| Screen | Positive artifacts | Negative / edge artifacts |
|--------|--------------------|----------------------------|
| **`/` Home — Guest** | Categories + grid full | Skeleton; empty category; error; **For you** tab disabled / removed; tap on Follow/Comment → AuthGateModal |
| **`/` Home — User** | Categories + grid + continue watching + live strip; **For you** enabled | Skeleton; empty category; error |
| **`/` Home — Creator** | Same as User + optional **"Your latest upload"** strip linking to `/studio` | Same negatives |
| **`/watch/[id]` — Guest** | Player + metadata + related | Comment composer **gated** (AuthGateModal); other negatives shared |
| **`/watch/[id]` — User** | Player + metadata + comments + related | Skeleton; **processing**; **failed**; **private/unlisted**; **404** removed |
| **`/watch/[id]` — Creator (owner)** | Adds **Edit video** + **Open in Studio** controls in metadata row | Same negatives |
| **`/[username]` — Visitor** | Banner + tabs + video grid + **Follow** button | Skeleton; no videos; 404 |
| **`/[username]` — Owner (Creator)** | Same as visitor + **Edit channel**, **Studio**, **Upload** replacing Follow | Skeleton; empty videos with "Upload your first video" CTA |
| **`/upload` — Guest** | — | AuthGateModal full-screen |
| **`/upload` — User** | — | RoleUpgradeGate "Become a creator" |
| **`/upload` — Pending User** | — | Redirect inline = `/waiting-approval` content |
| **`/upload` — Rejected User** | — | Redirect inline = `/approval-rejected` content |
| **`/upload` — Creator** | Wizard steps 1→2→3 success | Wrong file type; too large; progress + cancel; network error + Retry; processing wait |
| **`/studio` — Creator** | Overview + Videos table + Live + Comments + Analytics + Settings | Skeleton; empty (no videos yet) with primary Upload CTA; load error + Retry |
| **`/studio` — User / Guest** | — | RoleUpgradeGate (User) / AuthGateModal (Guest) |
| **`/login`** | Idle form | Wrong password inline; locked optional; submit loading |
| **`/signup`** | Idle form | Email taken, weak password, username invalid, terms unchecked submit blocked |
| **`/waiting-approval`** | Calm illustration | — |
| **`/approval-rejected`** | Message + CTAs | — |
| **`/notifications`** | List with mixed types | Empty; error load |
| **`/playlists/new`** | Empty form valid | Validation errors; save loading |
| **`/playlists/[id]`** | Videos listed + Play all | Empty playlist; private denied if not owner optional |
| **`/search`** | Results in tabs | Empty query placeholder; no results; suggestions typing; load skeleton |

### 10.3 Mobile — consumer (User + Creator)

| Screen | Positive | Negative / edge |
|--------|----------|------------------|
| **`/feed` — Guest / User / Creator** | Single-column variants (Creator adds Your latest upload strip) | Skeleton; empty; error + Retry; pull-to-refresh **indicator** |
| **`/explore`** | Search + results | No results; offline |
| **`/live`** | Live cards list | Empty live; error |
| **`/watch/:id` — Guest / User / Creator (owner)** | Player + sheet open; Creator-owner adds Edit | Processing; error; fullscreen vs inline; Guest comment gated |
| **`/profile/:username` — Visitor / Owner** | Profile populated; Owner sees Edit + Studio | 404; empty videos tab |
| **`/login` `/signup`** | Same as web | Same validation states |
| **Upload flow — User** | — | RoleUpgradeGate bottom-sheet |
| **Upload flow — Pending / Rejected** | — | Redirect screens |
| **Upload flow — Creator** | Step success | Same negatives as web upload |
| **`/studio` — Creator** | Overview + sections | Empty (no videos), error; **role-denied** bottom-sheet for non-creators |

### 10.4 Admin (Admin role only)

| Screen | Positive | Negative / edge |
|--------|----------|------------------|
| **Admin login** | Idle form (admin badge in copy) | Wrong credentials; **non-admin account → 403** |
| **Dashboard** | KPI cards with numbers (users, pending creators, videos in review, open reports) | Empty KPI placeholder; load error |
| **Users** | Table with rows + role pills (User / Creator / Admin) | Empty table; load error; suspend/change-role confirm |
| **Creator approvals** | Queue with applicant cards | **Empty queue** "All caught up"; approve **confirm**; reject **with reason** modal |
| **Content** | Videos table (status, reports count) | Empty; take-down **confirm**; restore **confirm** |
| **Categories** | Table CRUD | Empty; delete **confirm** (warn if videos attached) |
| **Reports** | Open reports list | Empty; resolve / dismiss **confirm** |
| **403 — Not authorized** | — | Shown when User or Creator hits any admin URL |

### 10.5 Engagement actions (micro-negative)

| Action | Positive feedback | Negative feedback |
|--------|-------------------|------------------|
| Follow | Button → Following | AuthGateModal if guest |
| Like | Icon filled | Same |
| Share | Toast "Link copied" | Permission denied toast optional |
| Report | Modal submitted → toast success | Network error |
| Comment post | Comment appears | Empty submit shake / error |

---

## 11. Master prompt — universal (paste into any AI)

Copy everything inside the fence below into **any AI tool** as the project / system prompt. Works as-is for Google Stitch, v0, Lovable, Galileo, Uizard, Figma AI, Subframe, Bolt, Claude, GPT, Gemini, etc. For tools with shorter context windows, split by §3 / §4 / §5 / §10 / §11.

```
PROJECT: FORGE — Skill-first creator learning platform.
GOAL: Generate COMPLETE UI (screens, components, or code, depending on your tool) including POSITIVE (success) and NEGATIVE (empty, error, denied, offline, validation) artifacts, FOR EACH ROLE.

OUTPUT FORMAT: Match the tool you are.
- If you are a design tool (Stitch, Galileo, Uizard, Figma AI): produce frames / pages.
- If you are a codegen tool (v0, Lovable, Bolt, Subframe): produce Next.js (App Router) + Tailwind for web, Flutter for mobile. Admin = Next.js + Tailwind dense table theme.
- If you are an LLM (Claude/GPT/Gemini): produce both the JSX/Flutter code AND a state-by-state narration.

ANTI-CLONE (CRITICAL): Do NOT create a complete or near replica of YouTube's visual design (colors, typography, layout clone, player chrome copy, sidebar copy). Use familiar VIDEO APP PATTERNS only for information architecture (home / watch / channel / search / upload). Visual language must be ORIGINAL: modern, refined, optionally futuristic (subtle glass, accent glow, contemporary type) — premium learning + creator product for 2025+, not a YouTube reskin.

BRAND: Learning + expertise + live + VOD. Skill chips on VideoCards and channel headers. Never generic TikTok-only UI.

=== ROLES (THREE + GUEST) ===
The product has THREE first-class roles plus Guest. Generate role variants where listed:
- GUEST: Unauthenticated. Read-only. Gated actions open AuthGateModal.
- USER (Viewer): Logged in. Browses, follows, likes, comments, builds playlists. CANNOT upload, go live, or access /studio. Sees "Become a creator" CTA in avatar menu.
- CREATOR: Approved creator. USER capabilities + Upload, Go live, Manage own videos, /studio dashboard. Avatar menu includes Studio + Upload + CreatorBadge.
- ADMIN: Lives ONLY in apps/admin (separate dense theme). Manages users, creator approvals, content moderation, categories, reports. Non-admin sessions hitting admin URLs see a 403 frame.

ROLE GATING RULES (mandatory):
- Guest taps Follow/Comment/Upload → AuthGateModal "Sign in to continue".
- User taps Upload/Go live/Studio → RoleUpgradeGate "Become a creator" (primary CTA: Apply).
- Pending User taps Upload → /waiting-approval screen.
- Rejected User taps Upload → /approval-rejected screen.
- Creator visits own channel → Edit + Studio + Upload replace Follow.
- Admin never appears in consumer chrome; consumer never links into admin.

=== DESIGN SYSTEM (implement all components) ===
Tokens: bg-app, bg-elevated, bg-muted, text-primary/secondary/tertiary, border-subtle, accent, accent-muted, live (red), success, warning, error.
Typography scale: Display, H1, H2, Body, Label, Meta (WCAG-friendly contrast).
Components to design as reusable: TopBar (Guest + User + Creator variants), SideNav (User + Creator), BottomNav (User + Creator), VideoCard + hover/focus, LiveCard, ChannelRow, SkillChip, CategoryChip, CreatorBadge, SegmentedControl (Latest|Popular|ForYou), SearchField, TextField + error state, PasswordField, TextArea, Select, Skill multi-picker, Checkbox, Primary/Secondary/Ghost/Destructive buttons, DragDropUpload zone, ProgressBar, Spinner, Skeleton (card grid + player block), EmptyState, ErrorState + Retry, Toast, InlineAlert, Modal, Drawer, BottomSheet (mobile watch), AuthGateModal, RoleUpgradeGate, ConfirmDialog, NotificationRow, CommentRow placeholder, Player chrome (controls + fullscreen), Pagination (admin), Admin DataTable + Admin SideNav.

Modes: Browse (light or soft-dark) + Watch page (dark cinema chrome) + Admin (utility neutral).

=== POSITIVE vs NEGATIVE (mandatory, per role where applicable) ===
For EVERY main screen generate separate artifacts:
- POSITIVE per role: Happy path, data shown, actions enabled.
- LOADING: Skeleton matching layout (not only spinner).
- EMPTY: Illustration + headline + primary CTA where lists can be empty.
- ERROR: Message + Retry (+ Go home if fatal).
- EDGE: AuthGateModal (Guest), RoleUpgradeGate (User), Pending / Rejected creator gates, Watch processing/failed/unavailable/private/404, Form validation errors, Offline banner, Session expired, Admin 403.

=== WEB — screens & required artifact variants ===
Shell: TopBar Guest | TopBar User | TopBar Creator | SideNav User | SideNav Creator | Mobile drawer (per role) | Offline banner | AuthGateModal | RoleUpgradeGate.

1) / Home — Guest Success | User Success | Creator Success (with "Your latest upload" strip) | Loading skeleton | Empty category | Feed error | Guest taps For-you → AuthGateModal
2) /watch/[id] — Guest (comment gated) | User Success | Creator-owner Success (Edit controls) | Loading | Processing video | Failed/unavailable | Private | Removed 404
3) /[username] — Visitor Success | Owner (Creator) Success (Edit/Studio/Upload) | Loading | Empty videos tab (with Upload CTA for owner) | User 404
4) /upload — Guest gate (AuthGate) | User gate (RoleUpgradeGate "Become a creator") | Pending gate | Rejected gate | Creator wizard each step Success | Invalid file | Too large | Upload progress | Upload error | Processing wait
5) /studio — Creator Overview Success | Videos table Success/Empty/Error | Live section | Comments | Analytics | Settings | User RoleUpgradeGate | Guest AuthGateModal
6) /login — Idle | Wrong credentials | Loading submit
7) /signup — Idle | Field validation errors | Loading submit
8) /waiting-approval — Positive illustration only
9) /approval-rejected — Negative messaging only
10) /notifications — List | Empty | Error
11) /playlists/new — Form valid | Validation errors
12) /playlists/[id] — With videos | Empty playlist
13) /search — Results | No results | Empty query state | Suggestions typing

=== MOBILE — screens & artifacts ===
Shell: BottomNav + MainScaffold (User and Creator variants; Creator center FAB opens upload directly, User center FAB opens RoleUpgradeGate).
/feed /explore /live /watch/:id /profile/:username /login /signup /upload /studio — mirror web positive/negative set per role; add Pull-to-refresh indicator on feed; BottomSheet on watch for metadata; mobile /studio uses SegmentedControl for sections.

=== ADMIN — utility theme (dense, not playful, separate app) ===
Admin shell: SideNav (Dashboard, Users, Approvals, Content, Categories, Reports, Settings) + top bar with env badge + admin avatar.
Screens: Admin login | Dashboard (KPIs) | Users table (with role pills) | Creator approvals (queue + empty + approve confirm + reject-with-reason modal) | Content table (take-down/restore confirms) | Categories CRUD (delete confirm with warning) | Reports inbox (resolve/dismiss confirms) | 403 Not authorized.
Each consumer-facing state set: Success populated | Empty | Load error | Row action confirm modal.

=== MICRO-INTERACTIONS ===
Follow/Like: active vs inactive (Guest → AuthGateModal). Share: toast success. Report: modal success vs error. Become-a-creator CTA: button → request modal → success state.

OUT OF SCOPE: Payments, tipping, DMs, kids mode, deep studio analytics charts.

OUTPUT NAMING: Name every artifact using `App / Route — Role — State` pattern (e.g. `Web / Home — User — Success`, `Web / Upload — User — RoleGate`, `Web / Studio — Creator — Empty`, `Mobile / Watch — Guest — CommentGated`, `Admin / Approvals — Empty`). Include dark watch layout + light browse default + admin neutral theme. Every artifact must pass the anti-clone rule: if it looks like YouTube with a swapped logo, redesign — push toward modern / futuristic / FORGE-distinct.
```

---

## 12. Single-turn quick prompts (drop-in for chat-based AIs)

Use these condensed prompts when you only want one screen or one feature at a time from a chat AI (Claude, GPT, Gemini, v0 chat, Lovable chat).

**Shell — three roles**
```
Generate the FORGE web app shell (Next.js + Tailwind) with TopBar + SideNav + Avatar menu, in THREE role variants: Guest, User (Viewer), Creator. Use the FORGE design tokens (--bg-app, --accent, etc.). Modern + slightly futuristic visual language; NOT a YouTube clone. Show all three side by side and include the AuthGateModal + RoleUpgradeGate components.
```

**Home — per role**
```
Generate FORGE `/` Home page in Next.js + Tailwind with three role variants (Guest, User, Creator). Include category strip, optional continue-watching rail (User/Creator), live-now strip, segmented (Latest|Popular|For you with For-you locked for Guest), responsive VideoCard grid with skill chips. Provide Success, Loading skeleton, Empty, and Error states.
```

**Upload — five gates**
```
Generate FORGE `/upload` route in Next.js + Tailwind, showing FIVE artifacts: Guest AuthGateModal, User RoleUpgradeGate "Become a creator", Pending screen, Rejected screen, and full Creator wizard (Select source → Details → Progress) with Processing end state.
```

**Studio — Creator only**
```
Generate FORGE `/studio` Creator dashboard in Next.js + Tailwind: vertical sub-nav (Overview, Videos, Live, Comments, Analytics, Settings) + right pane. Provide Overview Success, Empty (no uploads yet), Loading, Error. Also generate the RoleUpgradeGate variant for a User opening /studio.
```

**Admin — separate theme**
```
Generate the FORGE Admin app (Next.js + Tailwind) in a dense, utility theme (NOT consumer chrome). Include: Admin shell (SideNav + top bar with env badge + role pill), Dashboard (KPI cards), Users table (with role pills User/Creator/Admin), Creator approvals (queue + reject-with-reason modal + empty state), Content moderation table (take-down confirm), Categories CRUD, Reports inbox, and the 403 Not Authorized page.
```

**Mobile — Flutter**
```
Generate FORGE mobile (Flutter) screens for /feed, /watch/:id, /profile/:username, /upload, and /studio. Use Material-3-like primitives with FORGE tokens. Include BottomNav with Guest/User/Creator variants and FAB role behavior (Guest → AuthGateModal, User → RoleUpgradeGate, Creator → upload). Provide Success, Loading skeleton, Empty, Error for each list-based screen; pull-to-refresh indicator on feed; BottomSheet on watch.
```

---

## Related docs

- [mvp-audit.md](./mvp-audit.md) — API vs UI parity
- [Recommended_Things.md](./Recommended_Things.md) — stack (TanStack Query web, Riverpod mobile)
- [ui-ux-ai-design-prompt.md](./ui-ux-ai-design-prompt.md) — Google Stitch-flavored version of this same spec

---

*Tool-agnostic version — works with any AI design or codegen tool. FORGE monorepo.*
