# Packaging as a sellable kit

Family Calendar is config-driven (ADR-002): one identical build serves any
family — only `data/` (config + secrets, all on-device) differs. That makes it
straightforward to ship as a plug-and-play kit.

## What's in a kit

- Raspberry Pi 4 (4GB+) with a pre-flashed SD card
- HDMI display (or touchscreen) + mount
- Power supply
- One-page quick-start card (scan-to-set-up)

## Building the SD image

1. Flash Raspberry Pi OS (64-bit) and complete first boot on a build Pi.
2. Bootstrap the app:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/damdude/family-calendar/main/scripts/bootstrap.sh | bash
   ```
   This clones the repo to `~/family-calendar`, builds it, and installs the
   `family-calendar` + `family-calendar-kiosk` systemd services.
3. **Do not** run the setup wizard — leave the device unconfigured so the buyer
   configures it. Ensure `data/` contains no `config.json`, `device-secret`,
   `family.db`, `sites.json`, or uploaded photos (a clean checkout has none).
4. Power off, image the SD card (`dd` / Raspberry Pi Imager "clone"), and
   duplicate it for the run.

## First-boot experience for the buyer

1. Plug in the display + power. The kiosk shows the **QR setup screen**.
2. They scan it with a phone and complete the wizard (family, profiles,
   calendars) — no keyboard needed.
3. The device generates its own `device-secret` on first run, so at-rest
   encryption keys are unique per unit even from a shared image.

## Per-unit uniqueness & privacy

- The encryption key derives from the per-device `data/device-secret`
  (generated on first run) + `/etc/machine-id`, so a cloned image still yields
  unique, non-portable ciphertext once booted.
- No account, no cloud, no subscription. All data stays on the buyer's Pi.

## Support & updates

- OTA updates are on by default (every 4h) with automatic rollback (Batch 7);
  buyers get fixes without touching the device. They can pause updates in
  **Settings → Software updates**.
- Consider pinning the kit to a release tag/branch for a stable support surface.

## Licensing

MIT — you may sell hardware kits bundling this software. Keep the `LICENSE` file
intact and attribute the project.
