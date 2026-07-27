# Installation

> **Status:** placeholder — full Raspberry Pi install instructions land in
> Batch 6 (kiosk + systemd + HDMI display).

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:5173.

## Raspberry Pi (coming in Batch 6)

The production flow will be:

1. Flash Raspberry Pi OS (64-bit) to an SD card.
2. Run the one-line installer (Batch 10).
3. On first boot the Pi shows the QR-code setup screen; scan it with a phone to
   configure the family, profiles, and first calendar (Batch 2).
4. The dashboard launches in Chromium kiosk mode
   (`--ozone-platform=wayland`), managed by a systemd service.
