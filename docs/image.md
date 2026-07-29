# Building a flashable Raspberry Pi image (GitHub Actions)

Instead of installing on a running Pi, you can build a **complete SD-card image**
with Family Calendar + the kiosk baked in. First boot goes straight to the QR
setup screen; after that the device self-updates from GitHub.

The image is **64-bit (arm64)** — it runs on **Pi 5 / 4 / 400 / CM4** and also
boots **Pi 3 / Zero 2 W**. It does **not** boot Pi 2 (ARMv7, 32-bit only): pi-gen's
32-bit stage is unbuildable in CI, and a Chromium/Wayland kiosk isn't viable on
pre-64-bit boards anyway.

## Build it

1. On GitHub: **Actions → "Build Raspberry Pi image" → Run workflow**.
2. The job builds `pi-gen` on a **native arm64 runner** (no emulation, ~6–10 min)
   and produces an image artifact **`family-calendar-arm64`** (a compressed
   `.img.xz`). Download it from the run's Artifacts.
   (Publishing a GitHub Release also builds and attaches the image.)
3. The default login is `pi` / `changeme` (hostname `familycalendar` →
   `familycalendar.local`). Change the password after first boot.

Set Wi‑Fi with Raspberry Pi Imager's "edit settings" when flashing, or via
`raspi-config` on the device.

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

- The build uses a **native arm64 runner** (`ubuntu-24.04-arm`) and a pinned
  pi-gen release tag — this avoids the QEMU/binfmt emulation and stale-keyring
  (`debootstrap` GPG `NO_PUBKEY`) failures that plague 32-bit / x86-runner builds.
  (Approach mirrors the sibling `home-display` appliance.)
- To bump the OS, change `pi-gen-version` to a newer
  `YYYY-MM-DD-raspios-bookworm-arm64` release tag.
- The workflow passes `FC_REPO` / `FC_BRANCH` to the stage, so it always bakes in
  the branch you ran it from.
- See `docs/kit.md` for turning this into a sellable kit.
