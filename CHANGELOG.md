# Changelog

All notable changes to Family Calendar. This project is under active
development toward a 1.0 release.

## Unreleased

### Added — foundation (Batches 0–2)

- SvelteKit 2 + Svelte 5 (runes) + TypeScript scaffold, Tailwind 4, ESLint,
  Prettier; MIT license; ADRs.
- Design system: color tokens (calibrated to a Skylight reference), size-specific
  typography, apple-design-derived motion tokens.
- Weekly schedule matching the reference (profile pills, all-day/multi-day bars,
  diagonal split cards, overlap lanes, responsive 9–5 grid).
- Age-adaptive profile UIs (pre-reader / school-age / adult); kid routine
  tap-mode with confetti, stars, streaks, and Today's Feelings.
- Meals, Lists, Rewards views; feature-flag-aware sidebar; live-clock top bar.
- Config schema + QR/phone **setup wizard** with an SSE-driven live preview.

### Added — data + platform (Batches 3–5)

- Settings with a **portrait/landscape** orientation toggle; persisted config.
- **Encrypted photo upload** (AES-256-GCM, device-bound key).
- Kid-mode persistence: age routine library, streaks/completions, feelings
  history; celebration polish.
- **Google Calendar sync** (OAuth device flow, encrypted tokens) + encrypted
  SQLite with a migration runner; cron sync.
- Meals + custom lists persistence; **Sites of Interest** scraper (readability,
  robots.txt-aware) with per-profile feeds.

### Added — appliance (Batches 6–10)

- Raspberry Pi deployment: `adapter-node`, systemd units, Chromium **kiosk**
  (Wayland), installer; **read-only TV mode**.
- **OTA updates** with health-check and automatic rollback (systemd timer).
- Touchscreen **drag-scroll** (pointer events + momentum); **PIN parental lock**.
- **Screensaver** (B&W clock + photo rotation) + sleep-window scheduling.
- One-line bootstrap installer, CONTRIBUTING guide, kit-packaging guide.

### Notes

- Google Calendar sync requires a Google Cloud OAuth client
  (`GOOGLE_OAUTH_CLIENT_ID`/`SECRET` in `.env`).
- Not yet implemented: Apple iCloud / Outlook sync, a dedicated Tasks/Recipes/
  Photos tab (Photos screensaver ships; a photo library does not).
