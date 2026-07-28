#!/usr/bin/env bash
# Launch Chromium in kiosk mode pointing at the local dashboard.
# Uses the Wayland ozone backend (the stable path on current Raspberry Pi OS,
# learned from the home-display project).
set -euo pipefail

URL="${KIOSK_URL:-http://localhost:5173}"

# Pick whichever Chromium binary exists on this OS.
CHROMIUM="$(command -v chromium-browser || command -v chromium || true)"
if [ -z "$CHROMIUM" ]; then
	echo "chromium not found (install: sudo apt install -y chromium-browser)" >&2
	exit 1
fi

# Wait for the dashboard server to accept connections.
until curl -sf -o /dev/null "$URL"; do
	echo "waiting for $URL …"
	sleep 2
done

exec "$CHROMIUM" \
	--kiosk "$URL" \
	--ozone-platform=wayland \
	--start-fullscreen \
	--noerrdialogs \
	--disable-infobars \
	--disable-session-crashed-bubble \
	--disable-features=TranslateUI \
	--check-for-update-interval=31536000 \
	--overscroll-history-navigation=0 \
	--disable-pinch \
	--autoplay-policy=no-user-gesture-required \
	--password-store=basic
