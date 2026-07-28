# Family Calendar

An open-source, self-hosted, no-subscription family calendar dashboard designed to run on a Raspberry Pi with any HDMI TV or touchscreen. Inspired by Skylight Calendar and Hearth Display — but you own the hardware, code, and data.

## Features

- Multi-user family profiles with per-person color coding and avatars
- Subscribe to **any** calendar by iCal/webcal link (Google, Apple iCloud,
  Outlook, or any ICS feed); optional Google account connect
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

On a Raspberry Pi (Raspberry Pi OS 64-bit), one line installs everything —
server, Chromium kiosk, and systemd services:

```bash
curl -fsSL https://raw.githubusercontent.com/damdude/family-calendar/main/scripts/bootstrap.sh | bash
```

Or **flash a ready-made SD image** built by GitHub Actions (one 32-bit image
boots on Pi 2 / 3 / 4) — see [`docs/image.md`](docs/image.md).

On first boot the display shows a **QR code** — scan it with your phone to set up
the family, profiles, and calendars (no keyboard needed on the Pi). Full details
in [`docs/install/README.md`](docs/install/README.md); selling it as a kit is
covered in [`docs/kit.md`](docs/kit.md).

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

Under active development — all planned build phases are complete. See
[`docs/roadmap.md`](docs/roadmap.md) for phase status and
[`CHANGELOG.md`](CHANGELOG.md) for what shipped.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

MIT — see `LICENSE`.
