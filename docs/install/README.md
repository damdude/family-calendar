# Installation — Raspberry Pi

Family Calendar self-hosts on a Raspberry Pi as a long-lived Node server
(SvelteKit + `adapter-node`) with a Chromium kiosk on the HDMI display.

## Requirements

- Raspberry Pi 4 (4GB+) or newer
- Raspberry Pi OS (64-bit), **Wayland** session (the default on Bookworm)
- Any HDMI display (touchscreen optional)
- Network (Wi-Fi or Ethernet)

## Quick install

```bash
git clone https://github.com/damdude/family-calendar.git ~/family-calendar
cd ~/family-calendar
bash scripts/install.sh
```

`install.sh` installs Node.js, the build toolchain (for the `better-sqlite3`
native module) and Chromium, builds the app, and installs two systemd services:

- **`family-calendar`** — the dashboard server (`node build`, port 5173).
- **`family-calendar-kiosk`** — Chromium in kiosk mode
  (`--ozone-platform=wayland`) pointed at `http://localhost:5173`.

On first boot the kiosk shows the **QR setup screen** — scan it with your phone
to configure the family, profiles, and calendars (no keyboard needed on the Pi).

## Manual steps

```bash
# Build
npm ci --omit=dev && npm run build

# Server service
sudo cp deploy/family-calendar.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now family-calendar

# Kiosk service (Chromium on the HDMI screen)
chmod +x deploy/start-kiosk.sh
sudo cp deploy/family-calendar-kiosk.service /etc/systemd/system/
sudo systemctl enable --now family-calendar-kiosk
```

## Configuration

- Non-sensitive settings live in `data/config.json` (written by the setup
  wizard). Everything under `data/` stays on the device and is gitignored.
- Secrets go in `.env` (copied from `.env.example`). To enable Google Calendar
  sync, create a **"TVs and Limited Input"** OAuth client in Google Cloud and set
  `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`, then restart the
  server. Connect from **Settings → Calendar accounts**.
- The at-rest encryption key is derived from a device secret
  (`data/device-secret`, generated on first run) + `/etc/machine-id`, so copying
  the SD card's data elsewhere yields unreadable ciphertext.

## TV read-only mode

For a wall-mounted display where editing should only happen from phones, turn on
**Settings → Display → Read-only display**. The dashboard shows everything but
hides on-screen editing controls.

## Managing the services

```bash
sudo systemctl status family-calendar
sudo journalctl -u family-calendar -f      # server logs
sudo systemctl restart family-calendar
sudo systemctl restart family-calendar-kiosk
```

## Display orientation

For a portrait-mounted screen, set **Settings → Display orientation → Portrait**
(reflows the UI). To physically rotate the framebuffer, also set the display
rotation in `raspi-config` / the compositor.

## Updating

Automatic OTA updates are covered in Batch 7 (`scripts/update.sh` +
`family-calendar-update.timer`). To update manually:

```bash
cd ~/family-calendar && git pull && npm ci --omit=dev && npm run build
sudo systemctl restart family-calendar
```
