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

### Added — after the initial 11 batches

- **Universal calendar subscriptions**: add any calendar by its iCal/webcal link
  (Google, Apple iCloud, Outlook, or any ICS feed) — fetched, parsed, and
  recurrence-expanded into the grid. Google OAuth remains an option.
- **Prebuilt SD image via GitHub Actions** (`pi-gen` on a native arm64 runner):
  a 64-bit image (Pi 5 / 4 / 400 / CM4; also boots Pi 3 / Zero 2 W) with the app
  + a Chromium/cage Wayland kiosk baked in; first boot runs the QR setup, then
  self-updates from GitHub. See `docs/image.md`.

### Notes

- The prebuilt image is CI-built (untested on hardware in this repo's history) —
  flash and report issues.
- Google _account connect_ (OAuth) still needs a Google Cloud client
  (`GOOGLE_OAUTH_CLIENT_ID`/`SECRET`); the **iCal link** path needs no credentials.
- Not yet implemented: a dedicated Tasks / Recipes / Photos tab (the Photos-driven
  screensaver ships; a photo library does not).
