# Family Calendar

An open-source, self-hosted, no-subscription family calendar dashboard designed to run on a Raspberry Pi with any HDMI TV or touchscreen. Inspired by Skylight Calendar and Hearth Display — but you own the hardware, code, and data.

## Features
- Multi-user family profiles with per-person color coding and avatars
- Sync with Google Calendar, Apple iCloud (CalDAV), Outlook
- Kid-friendly visual routines with icons, streaks, and celebration animations
- Age-aware UI (adapts for pre-readers, school-age, teens, adults)
- Chore charts, star rewards, meal planning, custom lists
- "Today's Feelings" emoji check-ins for kids
- Photo/clock screensaver with configurable sleep mode
- QR-code phone-based setup — no keyboard needed on the Pi
- Sites of Interest — per-user URL feeds (kid's school news, weather stations, etc.)
- Fully config-driven — same code ships to any family, ready to sell as a kit

## Requirements
- Raspberry Pi 4 (4GB+) or newer
- Any HDMI display (touchscreen optional)
- Network connection (Wi-Fi or Ethernet)

## Quick start
See `docs/install/README.md` (populated once we reach Batch 6).

For local development:

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## Philosophy
- No subscription. Ever.
- Your data stays on your Pi.
- Sensitive data encrypted at rest.
- Open source, MIT licensed.
- Config-driven so families customize without changing code.

## Development status
Under active development. See `docs/roadmap.md` for phase status.

## Contributing
See `CONTRIBUTING.md` (populated in Batch 10).

## License
MIT — see `LICENSE`.
