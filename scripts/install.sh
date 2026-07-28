#!/usr/bin/env bash
# Family Calendar — Raspberry Pi installer.
# Idempotent: safe to re-run. Assumes Raspberry Pi OS (64-bit) with a graphical
# Wayland session, run as the 'pi' user.
#
#   bash scripts/install.sh
#
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/family-calendar}"
NODE_MAJOR=22

echo "==> Family Calendar installer"

# 1. Node.js (LTS) via NodeSource if not present / too old.
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt "$NODE_MAJOR" ]; then
	echo "==> Installing Node.js ${NODE_MAJOR}.x"
	curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | sudo -E bash -
	sudo apt-get install -y nodejs
fi

# 2. Build toolchain (for better-sqlite3 native module) + Chromium.
echo "==> Installing system packages"
sudo apt-get install -y build-essential python3 chromium-browser curl

# 3. App: this script runs from a checkout, so build in place.
cd "$APP_DIR"
echo "==> Installing dependencies + building"
npm ci --omit=dev || npm install --omit=dev
npm run build

# 4. .env — create from example if missing (user fills in secrets manually).
if [ ! -f "$APP_DIR/.env" ]; then
	cp "$APP_DIR/.env.example" "$APP_DIR/.env"
	echo "==> Created .env from .env.example — edit it to add Google OAuth creds."
fi

# 5. systemd services (server + kiosk).
echo "==> Installing systemd services"
sudo cp "$APP_DIR/deploy/family-calendar.service" /etc/systemd/system/
sudo cp "$APP_DIR/deploy/family-calendar-kiosk.service" /etc/systemd/system/
chmod +x "$APP_DIR/deploy/start-kiosk.sh"
sudo systemctl daemon-reload
sudo systemctl enable --now family-calendar
sudo systemctl enable --now family-calendar-kiosk

echo "==> Done. The dashboard is at http://localhost:5173"
echo "    First boot shows the QR setup screen — scan it with your phone."
