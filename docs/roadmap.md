# Roadmap

Phased, batch-by-batch delivery. Each batch is presented and approved before
starting the next.

| Batch | Scope                                                                                       | Status     |
| ----- | ------------------------------------------------------------------------------------------- | ---------- |
| 0     | Repo scaffold (SvelteKit 5 + TS + Tailwind, docs, ADRs, license)                            | ✅ Done    |
| 1     | Design system + fake data + primary mockup views                                            | ✅ Done    |
| 2     | Config schema + QR/phone setup wizard + SSE live preview                                    | ✅ Done    |
| 3     | Kid mode + Settings (orientation), encrypted photo upload, config/progress persistence      | ✅ Done    |
| 4     | Calendar sync (Google device flow), encrypted SQLite storage, SQLite migrations             | ⏳ Planned |
| 5     | Meal planning + custom lists persistence + Sites of Interest scraper                        | ⏳ Planned |
| 6     | Deploy to Pi + TV read-only mode (kiosk, systemd, HDMI)                                     | ⏳ Planned |
| 7     | OTA update mechanism + fail-safe rollback                                                   | ⏳ Planned |
| 8     | Touchscreen support (pointer events) + PIN-locked admin + parental lock                     | ⏳ Planned |
| 9     | Screensaver (B&W photo rotation + B&W clock) + sleep mode window                            | ⏳ Planned |
| 10    | Polish, docs, one-liner install, CONTRIBUTING.md, kit packaging                             | ⏳ Planned |

## Design references

- `docs/design/skylight-reference/` — drop Skylight product screenshots here to
  calibrate the weekly view visual language.
- `~/.claude/skills/apple-design/SKILL.md` — motion, gesture, material, and
  typography source of truth for every UI decision.
