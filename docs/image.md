# Building a flashable Raspberry Pi image (GitHub Actions)

Instead of installing on a running Pi, you can build a **complete SD-card image**
with Family Calendar + the kiosk baked in. First boot goes straight to the QR
setup screen; after that the device self-updates from GitHub.

The image is **32-bit (armhf)** so a single image boots on **Pi 2, Pi 3, and
Pi 4** — flash the same `.img` regardless of which you test on.

## Build it

1. On GitHub: **Actions → "Build Raspberry Pi image" → Run workflow**.
2. Set a **password** for the `pi` user (change it from the default!) and a
   hostname (default `familycalendar` → reachable at `familycalendar.local`).
3. The job runs `pi-gen` under ARM emulation (~30–60 min) and produces an image
   artifact **`family-calendar-pi-image`**. Download it from the run's Artifacts.
   (Publishing a GitHub Release also builds and attaches the image.)

How it works: `.github/workflows/build-pi-image.yml` runs pi-gen with the custom
stage in `pi-gen/stage-family-calendar/`, which installs Node, clones + builds
this repo into `/home/pi/family-calendar`, and enables systemd services:

- `family-calendar` — the dashboard server.
- `family-calendar-cage` — a **cage** Wayland kiosk (Chromium fullscreen on
  tty1; no desktop needed on Lite).
- `family-calendar-update.timer` — OTA update checks (every 4h, with rollback).
- `family-calendar-firstboot` — finishes the build on first boot if the emulated
  chroot build was incomplete (idempotent).

## Flash it

Use **Raspberry Pi Imager** (or Balena Etcher):

1. Unzip the artifact to get `…-family-calendar.img`.
2. Imager → **Use custom** → select the `.img` → choose your SD card → write.
3. (Optional) In Imager's settings, set Wi-Fi + locale so it joins your network
   on first boot. SSH is enabled (user `pi`, the password you chose).
4. Insert the card, connect HDMI + power.

## First boot

- The kiosk shows the **QR setup screen**. Scan it with your phone to configure
  the family, profiles, and calendars — no keyboard needed.
- Each device generates its own encryption key on first run, so a cloned image
  still yields unique, non-portable ciphertext once booted.
- Calendar sync: add any calendar's **iCal/webcal link** in
  **Settings → Calendars** (works with Google/iCloud/Outlook/any ICS), or connect
  a Google account if you've set OAuth credentials.

## Notes & tuning

- Pi 2 is slow — Chromium + first-boot build take a while; give it a few minutes.
- The workflow pins the 32-bit pi-gen (`pi-gen-version: arm`). For a Pi 4–only
  64-bit build, switch to `arm64` and a 64-bit base.
- To build from a fork/branch, set `FC_REPO` / `FC_BRANCH` in
  `pi-gen/stage-family-calendar/01-run-chroot.sh`.
- See `docs/kit.md` for turning this into a sellable kit.
