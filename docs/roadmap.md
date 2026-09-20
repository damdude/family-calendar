# Roadmap

Phased, batch-by-batch delivery. Each batch is presented and approved before
starting the next.

| Batch | Scope                                                                                  | Status  |
| ----- | -------------------------------------------------------------------------------------- | ------- |
| 0     | Repo scaffold (SvelteKit 5 + TS + Tailwind, docs, ADRs, license)                       | ✅ Done |
| 1     | Design system + fake data + primary mockup views                                       | ✅ Done |
| 2     | Config schema + QR/phone setup wizard + SSE live preview                               | ✅ Done |
| 3     | Kid mode + Settings (orientation), encrypted photo upload, config/progress persistence | ✅ Done |
| 4     | Calendar sync (Google device flow), encrypted SQLite storage, SQLite migrations        | ✅ Done |
| 5     | Meal planning + custom lists persistence + Sites of Interest scraper                   | ✅ Done |
| 6     | Deploy to Pi + TV read-only mode (kiosk, systemd, HDMI)                                | ✅ Done |
| 7     | OTA update mechanism + fail-safe rollback                                              | ✅ Done |
| 8     | Touchscreen support (pointer events) + PIN-locked admin + parental lock                | ✅ Done |
| 9     | Screensaver (B&W photo rotation + B&W clock) + sleep mode window                        | ✅ Done |
| 10    | Polish, docs, one-liner install, CONTRIBUTING.md, kit packaging                        | ✅ Done |

## Design principles

The UI prioritizes:

- **Family-friendly** visual language with pastel colors and clear typography
- **Age-adaptive** interfaces (pre-reader, school-age, teen, adult)
- **Smooth interactions** with thoughtful motion and transitions
- **Accessibility** with high contrast and readable fonts
