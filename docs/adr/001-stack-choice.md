# ADR 001 — Technology stack

- **Status:** Accepted
- **Date:** 2026-07-27
- **Deciders:** Project maintainers

## Context

Family Calendar runs unattended on a Raspberry Pi 4 (4GB+) driving an HDMI TV
or touchscreen in kiosk mode. It must:

- Render a rich, animated dashboard at 30–60fps on modest ARM hardware.
- Persist family data locally with no cloud dependency and encrypt sensitive
  fields at rest.
- Serve a companion phone wizard over the LAN for keyboard-free setup.
- Run periodic background jobs (calendar sync, site scraping, OTA checks).
- Stay approachable for open-source contributors.

The sibling project `home-display` validated a SvelteKit + SSE + kiosk-Chromium
architecture on the same class of hardware, so we start from proven ground.

## Decision

- **SvelteKit 2 + Svelte 5 (runes mode).** Compiles to small, fast bundles —
  important on a Pi. Runes (`$state`, `$derived`, `$effect`, `$props`) give
  fine-grained reactivity that maps cleanly onto SSE-driven live data. A single
  framework covers both the kiosk dashboard and the companion phone wizard.
- **TypeScript, strict mode.** Catches errors before they reach an appliance
  that has no keyboard to debug on.
- **Tailwind CSS 4 (Vite plugin).** Utility classes plus our own design-token
  layer. Tailwind 4's Vite integration removes the old PostCSS config step.
- **better-sqlite3.** Synchronous, embedded, zero-daemon SQLite — ideal for a
  single-process appliance. No network DB to secure or keep alive.
- **Node built-in `crypto`.** AES-256-GCM at-rest encryption with a device-bound
  key. No third-party crypto dependency to audit.
- **node-cron.** In-process scheduling for sync/scrape/update jobs; no system
  cron entries to manage from inside the app.
- **@mozilla/readability + jsdom.** Battle-tested main-content extraction for the
  Sites of Interest feature.
- **Chromium kiosk with `--ozone-platform=wayland`.** Learned from
  `home-display`; the Wayland ozone backend is the stable path on current
  Raspberry Pi OS.

## Consequences

- One language and one framework end-to-end lowers the contribution barrier.
- `better-sqlite3` is a native module and must be rebuilt per Node/ABI version;
  the OTA update flow (Batch 7) accounts for this.
- Synchronous SQLite calls must stay off hot render paths; heavy queries run in
  cron jobs or request handlers, never in reactive `$effect`s.
- Committing to Svelte 5 runes means avoiding legacy store patterns; new state is
  runes-first.

## Alternatives considered

- **React/Next.js** — heavier runtime and hydration cost on a Pi; larger bundles.
- **Plain Vue/Vite** — viable, but SvelteKit's file-based routing and SSR/SSE
  story is a better fit and matches `home-display`.
- **Postgres/MySQL** — operational overhead (a daemon to run, secure, back up)
  with no benefit for a single-family, single-device workload.
