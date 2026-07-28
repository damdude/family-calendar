# Contributing to Family Calendar

Thanks for your interest! Family Calendar is an open-source, self-hosted family
dashboard for the Raspberry Pi. Contributions of all kinds are welcome.

## Development setup

```bash
git clone https://github.com/damdude/family-calendar.git
cd family-calendar
npm install
npm run dev        # http://localhost:5173
```

Requirements: Node 20+ (the native `better-sqlite3` module builds on install;
you may need `build-essential` / `python3` on Linux).

## Project layout

- `src/routes/(app)/` — the dashboard views (calendar, lists, meals, rewards,
  settings, profile) behind the sidebar/top-bar shell.
- `src/routes/setup/` — the QR + phone setup wizard (SSE-driven).
- `src/lib/components/` — shared UI. `src/lib/ui/` — age-adaptive profile UIs.
- `src/lib/design/` — design tokens, typography, motion (see `docs/adr` and the
  apple-design principles the motion follows).
- `src/lib/server/` — server-only: config/progress/family-data stores, SQLite
  (`db/`), at-rest `crypto.ts`, Google `google.ts`/`sync.ts`, scraper, PIN, cron.
- `src/lib/fake/` — **the only place demo/literal family data may live** (ADR-002).
- `deploy/` + `scripts/` — systemd units, kiosk launcher, install/update scripts.

## Ground rules

- **No hardcoded family data** outside `src/lib/fake/` (ADR-002). Rendered UI
  reads from the store.
- **No secrets in the repo.** Secrets go in `.env` (gitignored); sensitive data
  is encrypted at rest (`crypto.ts`). Everything under `data/` stays local.
- **Every feature is a config toggle** — add the flag and an empty/disabled state.
- Motion/gesture/typography follow the apple-design principles (springs,
  1:1 tracking, reduced-motion, size-specific tracking).

## Before you push

```bash
npm run check    # svelte-check (0 errors / 0 warnings expected)
npm run lint     # prettier + eslint
npm run format   # auto-format
npm run build    # production build (adapter-node)
```

Conventional-commit style messages (`feat:`, `fix:`, `docs:`, `chore:`) are
appreciated. Open a PR against `main` with a clear description and, for UI
changes, a screenshot.

## Reporting issues

Include your Pi model, Raspberry Pi OS version, and relevant logs
(`journalctl -u family-calendar`). Never paste real secrets or tokens.
