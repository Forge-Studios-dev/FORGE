        # FORGE — Google Stitch Design Brief

        **Purpose:** A complete, self-contained brief to feed into **Google Stitch** (text/image-to-UI) so you can generate UI/UX designs for the entire FORGE platform. Everything you need — product vision, goals, users, brand/visual language, navigation, full screen inventory, and prompt-ready specs — is contained in this single document. This is a **design-only** brief; it does not change any engineering behavior.

        > **How to use with Stitch:** Read §1–§4 for product context, paste §5.6 (the global style prompt) into your Stitch project's style settings so the look stays consistent, then generate screens one at a time using the ready-made prompts in §9. Stitch works best one screen at a time with a fixed style — keep the palette and typography constant across every prompt.

        ---

        ## 1. Product in one paragraph

        **FORGE** is a **skill-first Creator Economy Operating System** — the most useful parts of YouTube, Skillshare, Patreon, Discord, Circle, Twitch, Kajabi, Mighty Networks, Skool, Coursera, and Netflix unified into one premium product. Creators teach skills through on-demand videos, live streams, structured courses/programs/cohorts, and engaged communities, and they monetize through memberships, tiers, paid events, super chat, and bundles. Learners discover creators by skill and category, watch and learn, join communities, attend live sessions, and subscribe. FORGE spans **web, mobile (iOS/Android), and an operator admin app**.

        **Positioning line:** *Not a YouTube clone.* Premium, modern, creator-first, learning-focused. Familiar video information architecture, but a distinct, refined visual identity.

        ---

        ## 2. Goals & value propositions

        | Goal | What it means for design |
        |------|--------------------------|
        | **Skill-first discovery** | Browsing is organized by categories, skills/tags, search, and curated feeds (For You / Popular / Latest) — not just an infinite video wall. |
        | **Trusted creators** | Creators are approved before they can publish or go live — surface trust signals, verified states, and approval/onboarding flows. |
        | **Learn by watching** | Fast, clean VOD + live playback with adaptive quality, minimal layout shift, and clear access/paywall states. |
        | **Community engagement** | Communities with text/voice/stage rooms, posts, threads, polls, events, wiki, challenges, and gamification (XP, badges, streaks, leaderboards). |
        | **Creator monetization** | Membership tiers, subscriptions, paid events, super chat, bundles, and programs — with clear pricing and entitlement UX. |
        | **Creator business OS** | A Studio with dashboards for revenue, subscribers, content, live, community, moderation, and analytics. |
        | **Operations & trust/safety** | An Admin app for creator approvals, moderation queues, reports, taxonomy, and platform analytics. |
        | **Scale & performance** | Designed for millions of users and 100k+ concurrent live viewers — designs favor clarity, virtualized lists, and lightweight surfaces. |

        ---

        ## 3. Target users (personas)

        1. **The Learner / Member (consumer).** Wants to find quality skill content fast, follow creators, watch VOD/live, join communities, and decide whether to pay for premium tiers. Primary on mobile + web.
        2. **The Creator (teacher / entrepreneur).** Uploads videos, goes live, builds courses/programs, runs communities and events, sets membership tiers and prices, and monitors revenue + engagement via Studio.
        3. **The Community Manager / Moderator / Coach.** Sub-roles inside a creator's community; moderate content, manage rooms/events, approve join requests, and run engagement.
        4. **The Platform Operator / Admin.** Approves creators, moderates reported content, manages categories/taxonomy, and reviews platform-wide analytics in a separate Admin app.

        **Role hierarchy (highest to lowest access):** Super Admin → Platform Admin → Creator → Community Manager → Moderator → Coach → Paid Member → Free Member → Guest.

        **Community sub-roles & permissions (for community management screens):**
        - **Owner** — all community permissions.
        - **Admin** — everything except assigning roles.
        - **Moderator** — view, post, manage posts, moderate, ban, suspend, approve join requests, manage events.
        - **Coach** — view, post, manage posts, manage events, view analytics.
        - **Member** — view community, post in community.
        - Permission keys to reflect in UI: view community, post, manage posts, manage rooms, manage channels, manage events, moderate content, ban members, suspend members, approve join requests, assign roles, export members, view analytics, manage settings.

        ---

        ## 4. The three surfaces to design

        | Surface | Platform | Audience | Visual priorities |
        |---------|----------|----------|-------------------|
        | **Web (consumer)** | Desktop + responsive | Learners + Creators | Rich discovery, watch experience, community, creator Studio |
        | **Mobile** | iOS / Android (Flutter) | Learners + Creators | Feed-first, thumb-friendly, bottom nav, native video, offline-aware |
        | **Admin** | Desktop | Operators | Dense, table-driven, efficient moderation & analytics |

        ---

        ## 5. Design language (paste this into Stitch as the global style)

        FORGE uses the **"Forge Narrative"** design system — a dark, premium, purple-forward identity. Keep this constant across every generated screen.

        ### 5.1 Color palette (dark theme)

        | Token | Hex | Use |
        |-------|-----|-----|
        | Background / Surface | `#15121B` | App background (deep plum-black) |
        | Surface container lowest | `#0F0D15` | Recessed wells, page base |
        | Surface container low | `#1D1A23` | Cards (resting) |
        | Surface container | `#211E27` | Cards, panels |
        | Surface container high | `#2C2832` | Raised cards, menus |
        | Surface container highest | `#37333D` | Hover / active surfaces |
        | On background / On surface | `#E7E0ED` | Primary text (soft lavender-white) |
        | On surface variant | `#CBC3D7` | Secondary text |
        | Outline | `#958EA0` | Borders, dividers |
        | Outline variant | `#494454` | Subtle borders |
        | **Primary** | `#D0BCFF` | Primary actions, accents (soft violet) |
        | On primary | `#3C0091` | Text/icon on primary |
        | Primary container | `#A078FF` | Stronger primary fills, gradients |
        | **Secondary** | `#4CD7F6` | Highlights, secondary accents (cyan) |
        | Secondary container | `#03B5D3` | Stronger cyan |
        | **Tertiary** | `#FFB869` | Warm accent (amber) — rewards, highlights |
        | Error | `#FFB4AB` | Errors |
        | Error container | `#93000A` | Strong error |
        | **Live** | `#FF453A` | LIVE badges, live indicators (red) — reserved |

        **Mood:** premium, focused, "studio at night." Dark plum-black canvas, soft violet primary, electric cyan + warm amber accents, vivid red reserved exclusively for LIVE.

        ### 5.2 Typography

        - **Display / headings:** `Space Grotesk` — geometric, modern. Display 48px/700; Headline 32px/600 (24px/600 on mobile).
        - **Body:** `Inter` — 16px/400 for readable body copy.
        - **Labels / metadata / tags:** `Geist` (monospace feel) — 12px/600, UPPERCASE, letter-spacing 0.08em for tags, badges, and eyebrow labels.

        ### 5.3 Spacing, layout, radius

        - Spacing unit: 4px. Gutter: 24px. Container max-width: **1440px**.
        - Page margins: 48px desktop / 20px mobile.
        - Radius: sm 4px · default 8px · md 12px · lg 16px · xl 24px · full (pills / avatars).
        - Generous whitespace; avoid overcrowded screens. Favor cards, clear section headers, and skill-tag chips.

        ### 5.4 Motion & feel

        - Subtle, premium motion: fade-in, page-enter, staggered grid reveals. Nothing flashy or bouncy.
        - Optimistic, responsive interactions; use loading skeletons (feed grid, lists) instead of spinners where possible.

        ### 5.5 Component vocabulary

        Buttons, Inputs, page headers, **skill-tag chips** (uppercase pill), **LIVE badge** (red pill), empty states, status pages, icons, loading skeletons, confirm dialogs. Cards are the dominant container. Use chips for skills/categories everywhere discovery happens.

        ### 5.6 Stitch global style prompt (copy / paste)

        > Design a premium, dark-themed creator learning platform called FORGE. Background `#15121B` (deep plum-black), cards in `#211E27`, raised surfaces `#2C2832`. Primary accent soft violet `#D0BCFF` with `#A078FF` for stronger fills; secondary accent electric cyan `#4CD7F6`; warm amber `#FFB869` for rewards; red `#FF453A` ONLY for LIVE indicators. Text is soft lavender-white `#E7E0ED`, secondary text `#CBC3D7`. Headings use Space Grotesk (bold, geometric), body uses Inter, and small uppercase labels/tags use a Geist monospace with letter-spacing. Rounded corners (8–16px), generous spacing, card-based layout, subtle fade/stagger motion, skill-tag pill chips, and clean loading skeletons. Modern, creator-first, skill-learning focused — NOT a YouTube clone. Max content width 1440px.

        ---

        ## 6. Information architecture & navigation

        ### 6.1 Web (consumer)

        - **Primary nav:** Home, Explore, Live, Library, Search.
        - **Discovery sub:** Explore by skill, Discover communities, Discover courses.
        - **User area:** Profile, Notifications, Messages, Settings (incl. Memberships), History, Playlists.
        - **Creator area (Studio):** Studio home, Videos, Live, Comments, Analytics, Tiers, Subscribers, Bundles, Courses, Programs, Communities, Moderation, Brands, Settings.
        - **Auth:** Login, Signup, Forgot/Reset password, Verify email, Waiting approval, Approval rejected, Session expired.

        ### 6.2 Mobile — bottom nav (5 tabs)

        - **Feed · Explore · Live · Library · Profile** (Studio is reachable from Profile via a creator gate). Secondary: Notifications, Messages, Community rooms, Upload, Studio sub-screens.

        ### 6.3 Admin — sidebar

        - Dashboard, Users, Creator approvals, Content, Reports, Categories, Analytics, Search, Settings.

        ---

        ## 7. Complete screen inventory (everything to design)

        ### Consumer (web + mobile)
        - **Discovery:** Home/Feed (For You / Popular / Latest), Explore, Explore by skill, Search + suggestions, Discover communities, Discover courses.
        - **Watch:** VOD watch page (player, metadata, creator card, likes/comments, related), Watch history.
        - **Live:** Live directory (live + upcoming), Live watch (player + chat + reactions + polls + super chat + RSVP).
        - **Profile (public):** Creator/user profile, followers, following, public community, public program.
        - **Community:** Community home, text room (chat/threads), voice room, stage / raise-hand, updates/announcements, welcome modal, posts/polls/events/wiki/challenges, gamification (XP/badges/leaderboard).
        - **Courses & programs:** Course detail/viewer, program viewer, enrollment.
        - **Membership:** Tiers purchase, manage memberships/subscriptions, paywall / access-denied states.
        - **Social:** Notifications, Messages (DM conversations), Playlists.
        - **Account / Auth:** Login, Signup, OAuth callback, Forgot/Reset password, Verify email, Waiting approval, Approval rejected, Session expired, Profile settings.
        - **System:** Offline, Maintenance, Terms, Privacy.

        ### Creator Studio (web + mobile)
        - Studio dashboard, Videos manager, Upload flow (multi-step + progress), Live manager / go-live, Comments manager, Analytics (revenue, subscribers, engagement, content, live), Tiers editor, Subscribers list, Bundles, Courses manager + detail, Programs manager, Communities manager + detail, Moderation queue + detail, Brands, Studio settings, Become-a-creator.

        ### Admin
        - Login, Dashboard (stats), Users + user detail (videos/reports/history tabs), Creator approvals, Content moderation, Reports queue + detail, Categories CRUD, Platform analytics, Cross-platform search, Settings.

        ---

        ## 8. Feature domains (full functional context)

        Use this to understand what each screen must support.

        - **Auth & sessions:** email/password + Google OAuth, email verification (incl. OTP), forgot/reset password, refresh-token sessions, session list, login history, anti-account-sharing via device caps and a single active premium viewing session.
        - **Discovery:** categories, subcategories, skill tags; feeds — latest, popular, trending, recommended (For You), following; full-text search with suggestions.
        - **Video (VOD):** resumable/multipart uploads, adaptive HLS playback, view/watch tracking, thumbnails, visibility (public vs members-only/tier-gated).
        - **Live:** live streaming with stream chat, reactions, polls, super chat, clips, replays, RSVP/reminders, slow mode, moderators, browser go-live and RTMP, paid-event access.
        - **Engagement:** likes, threaded comments + replies + comment likes, follows/followers, watch history, playlists.
        - **Direct messages:** 1:1 conversations, send, read receipts.
        - **Memberships & billing:** subscription tiers with entitlements, member subscriptions, lifecycle states (Trial, Active, Paused, Grace period, Expired, Cancelled, Renewal pending, Failed payment, Suspended, Refunded), Stripe checkout for paid events and super chat, bundles, programs enrollment.
        - **Communities 2.0:** structure is Brand → Community → Category → Channel → Room → Discussion → Thread → Comment. Community types: public, private, paid, invite-only, plus course/event/cohort communities. Rooms: text, voice, stage (raise-hand, audience requests, guest speakers, multi-host, VIP rooms). Posts, announcements/updates, polls, surveys, wiki/knowledge base, challenges, events/meetups, office hours, mentorship.
        - **Courses & programs:** courses, lessons, lesson progress, cohorts, programs with enrollment.
        - **Gamification & loyalty:** XP, levels, reputation, streaks, achievements, badges, referrals, ambassadors, leaderboards.
        - **Creator Studio & BI:** dashboards for revenue/MRR, subscribers, content, live, community, funnels, cohorts, engagement, retention, churn, growth; subscriber export.
        - **Moderation & trust/safety:** reports intake, flagged content, banned/suspended members, join-request approvals, audit logs.
        - **Notifications:** in-app notifications + push (mobile), unread counts, device registration.
        - **AI (roadmap surfaces):** creator copilot, community assistant, AI moderation, AI search, AI tagging, summaries (live & discussion), recommendations, health scoring, churn/risk prediction.
        - **System:** offline, maintenance, terms, privacy, health states, impersonation handoff (admin).

        ---

        ## 9. Screen-by-screen Stitch prompts

        Each prompt assumes the global style from §5.6. Generate one screen at a time. For mobile, prepend *"Mobile app screen, 390×844, with a bottom tab bar."* For web, prepend *"Desktop web app, 1440px wide, with left/top navigation."*

        ### 9.1 Home / Feed (consumer)
        > A skill-learning home feed. Top bar with FORGE wordmark, global search, notifications bell, and avatar. A horizontal row of skill-category pill chips (Design, Code, Music, Business, etc.) for filtering. Tabs for "For You / Popular / Latest". A responsive grid of video cards: 16:9 thumbnail with rounded corners, duration badge, a red LIVE pill on live items, title, creator avatar + name with a small verified check, view count, and skill tags as small uppercase chips. A slim "Continue watching" rail at the top with progress bars. Premium dark plum-black background, violet accents.

        ### 9.2 Explore / Discover
        > An explore page organized by skills. Large heading "Explore skills". A masonry of category cards with gradient violet/cyan overlays and an icon per category. Below, sections like "Trending creators" (avatar cards) and "Live now" (live thumbnails with red badges). Skill chips for quick filtering. Card-based, airy spacing.

        ### 9.3 Search
        > A search results screen. Prominent search input with a live suggestions dropdown (recent + suggested skills). Filter chips (Videos, Creators, Communities, Courses, Live). Mixed results list: video rows, creator rows with follow buttons, community cards. Clean empty state illustration when there is no query.

        ### 9.4 Watch (VOD)
        > A video watch page. Large 16:9 player at top. Below: video title (Space Grotesk), creator row (avatar, name, verified, subscriber count, a violet "Subscribe" / membership button), action bar (like, comment, save to playlist, share), and skill-tag chips. Expandable description card. A comments section with threaded replies and like counts. Right rail (desktop) of related video cards. Include a "members-only" paywall variant where the player is blurred with a violet "Unlock with membership" card.

        ### 9.5 Live watch
        > A live streaming watch screen. Left: large player with a red LIVE badge and live viewer count. Right: a live chat panel with messages, a highlighted super-chat message (amber/violet gradient), floating reaction emojis, a pinned message, and a poll widget. Below the player: stream title, creator card, and an RSVP/notify button. Hint at slow-mode and moderator controls. Dark, energetic, but premium.

        ### 9.6 Live directory
        > A "Live" page. Hero of the top live stream. A grid of "Live now" cards (red LIVE badge, viewer count, creator) and an "Upcoming" section with scheduled streams showing a countdown and RSVP buttons.

        ### 9.7 Creator public profile
        > A public creator profile. Cover banner with gradient, large avatar, creator name + verified badge, bio, follower/subscriber stats, and a prominent "Join / Subscribe" membership CTA. Tabs: Videos, Live, Courses, Community, About. Grid of content below. A membership tiers teaser card with pricing.

        ### 9.8 Community home
        > A community home inside a creator's space (Discord/Circle-like but premium). Left sidebar: community categories and rooms (text rooms with #, voice rooms with a speaker icon, stage rooms). Center: a feed of community posts with reactions, polls, and announcements, plus a composer at the top. Right rail: members online, upcoming events, and a leaderboard (top members with XP and badges). Include a welcome/onboarding modal variant for first join.

        ### 9.9 Community text room
        > A real-time text chat room. Channel header with name and member count. Message list with avatars, threaded replies, reactions, and a pinned-message banner. Composer with attachment, emoji, and mention support. A member list drawer.

        ### 9.10 Community voice / stage room
        > A live audio room (Twitter Spaces-like). Center grid of speaker avatars with a speaking-ring animation and mute indicators. A "Stage" with hosts on top and audience below. A "Raise hand" button for the audience and host controls to invite/mute. Dark, focused, with a violet speaking glow.

        ### 9.11 Course / Program viewer
        > A course learning screen. Left: curriculum sidebar with modules and lessons (checkmarks for completed, lock icons for gated). Center: lesson video player + lesson title + rich text content and downloadable resources. Progress bar across the top. "Mark complete / Next lesson" buttons. Right: cohort/community link and Q&A.

        ### 9.12 Membership / Tiers (purchase)
        > A membership purchase screen. 2–4 pricing tier cards side by side (Free, Premium, VIP) with feature checklists, monthly price, and a highlighted "Most popular" tier with a violet glow border. Each lists entitlements (videos, live, community, courses). Clear CTA buttons, trust copy, and a secure-payment note.

        ### 9.13 Manage memberships (settings)
        > A "My memberships" settings screen. A list of active subscriptions: creator avatar, tier name, status pill (Active/Trial/Grace/Cancelled), renewal date, price, and manage/cancel buttons. A billing history table. Clean account-settings aesthetic.

        ### 9.14 Notifications & Messages
        > (a) A notifications list: grouped by Today/Earlier, each row with an icon, actor avatar, text, timestamp, and an unread dot. Tabs for All/Mentions. (b) A direct-messages screen: left conversation list with avatars and last-message preview, right chat thread with bubbles and read receipts.

        ### 9.15 Auth set
        > Auth screens for FORGE: Login and Signup with email + Google button, FORGE wordmark, and a split layout with a branded gradient panel on one side (violet→cyan) and the form on the other. Plus minimal variants for Forgot password, Verify email (with OTP boxes), Waiting-for-approval (creator pending state with a friendly illustration), and Session expired.

        ### 9.16 Creator onboarding / Become a creator
        > A "Become a creator" multi-step screen: a progress stepper, fields for channel name, skills/categories, bio, and sample work. Friendly, encouraging tone, premium illustration, and a clear "Submit for approval" CTA. Include a post-submit "pending approval" state.

        ### 9.17 Upload flow (Studio)
        > A video upload flow. A drag-and-drop upload zone with a progress bar (resumable/multipart), then a metadata step: title, description, category + skill-tag chips, thumbnail picker (auto-generated options + custom upload), visibility (public / members-only tier selector), and schedule. A right-side preview of the video card as it will appear. Clear step indicator.

        ### 9.18 Studio dashboard
        > A creator Studio home dashboard. Welcome header with creator name. KPI stat cards (Revenue/MRR, Subscribers, Views, Watch time, Live sessions) with trend sparklines and up/down deltas in cyan/amber. A revenue line chart, a recent-activity feed, a top-videos table, and quick actions (Upload, Go live, New course). Left Studio sidebar nav. Data-dense but elegant on dark surfaces.

        ### 9.19 Studio analytics
        > A creator analytics screen. Tabs: Revenue, Subscribers, Engagement, Content, Live. Charts (line + bar + area) with violet/cyan series, a date-range picker, KPI cards, a funnel (visitor→subscriber→paid), churn and retention widgets, and an exportable subscribers table. Professional BI feel, dark theme.

        ### 9.20 Studio tiers & subscribers
        > (a) A membership tiers editor: a list of tier cards with inline edit (name, price, entitlement toggles for videos/live/community/courses), reorder, and an "Add tier" action. (b) A subscribers screen: a searchable table (member, tier, status, MRR contribution, joined date, last active) with filters and an export button.

        ### 9.21 Studio moderation
        > A creator moderation queue. Tabs: Reports, Flagged content, Banned members, Join requests. A queue list with item preview, reason, reporter, a severity pill, and Approve/Remove/Ban action buttons. A detail panel on the right showing full context and an audit trail. Trust-and-safety tone.

        ### 9.22 Studio communities manager
        > A screen to manage a creator's communities: a list of communities (cover, name, members, status), and a community detail with rooms management, roles (owner/admin/moderator/coach/member) shown as a permission matrix, an events scheduler, and engagement settings.

        ### 9.23 Studio live manager / Go live
        > A go-live setup screen: stream title, category/skills, thumbnail, a visibility/paid-event toggle with price, "Go live (browser)" and "RTMP key" options, and scheduled-vs-now selection. After going live: a live control room with viewer count, chat moderation, polls, and "End stream" + post-stream replay settings.

        ### 9.24 Admin dashboard
        > An operator admin dashboard (a separate, denser app). Left sidebar (Dashboard, Users, Creator approvals, Content, Reports, Categories, Analytics, Search, Settings). Main: platform KPI cards (total users, creators, videos, live now, reports open), charts, and a recent-reports table. Utilitarian and table-heavy, still on the FORGE dark theme but more compact.

        ### 9.25 Admin creator approvals & reports
        > (a) A creator approvals queue: a table of pending creators with profile preview, requested skills, sample content, and Approve/Reject buttons with reason. (b) A reports queue: a table of reported content/users with status, severity, and type filters; plus a report detail page with the reported item, reporter info, history, and resolution actions.

        ### 9.26 System states
        > Empty states, an error/status page, Offline, and Maintenance screens for FORGE: centered illustration, headline in Space Grotesk, supportive subtext, and a primary action button — all on the dark plum-black theme with violet accents.

        ---

        ## 10. Cross-cutting UX requirements

        - **Access & paywall states:** Every premium surface needs clear locked / members-only / access-denied variants (blurred preview + unlock CTA + reason). Reflect membership lifecycle states: Trial, Active, Paused, Grace period, Expired, Cancelled, Renewal pending, Failed payment, Suspended, Refunded.
        - **Trust signals:** Verified creator badges, approval states, and moderation indicators.
        - **Live identity:** Reserve red `#FF453A` strictly for LIVE; never use it for primary actions.
        - **Skill chips everywhere:** Discovery, watch, profiles, and upload all use uppercase skill-tag chips.
        - **Loading:** Use skeletons (feed grid, lists) for perceived speed.
        - **Responsive:** Web layouts must gracefully collapse to tablet/mobile; mobile uses bottom-tab navigation.
        - **Accessibility:** Sufficient contrast on the dark theme, visible focus, keyboard support, and labeled controls.
        - **Gamification:** XP, levels, streaks, badges, and leaderboards — design these as warm-amber/violet reward accents.

        ---

        *This is a design-only brief. The palette, typography, and spacing above are the canonical FORGE visual identity; keep them constant across all generated screens.*
