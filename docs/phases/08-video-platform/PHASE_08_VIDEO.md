# Phase 08 — Video Platform

**Status:** Complete for watch/player parity slice (verified)

## Goal

YouTube-like watch experience: speed, theater, captions/transcript when available, keyboard shortcuts, related rail.

## Shipped / verified

- Playback speed selector on VOD (`VideoPlayer`; hidden for live)
- Theater mode + miniplayer on watch (`WatchExperience`)
- Keyboard: space/k play-pause, j/l ±10s, arrows seek/volume, m mute, f fullscreen, i miniplayer, c captions, 0–9 scrub, </> rate
- Captions via `captionUrl` / `captionTracks` + `TranscriptPanel` / chapters
- Related empty state; sidebar SkillChip off on `FeedCard`

## Deferred

- Custom player chrome replacing native `<video controls>` (polish only)

See [PHASE_08_REPORT.md](./PHASE_08_REPORT.md).
