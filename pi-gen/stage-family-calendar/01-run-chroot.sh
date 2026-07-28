#!/bin/bash -e
# Runs inside the image's root filesystem (ARM-emulated in CI). Installs Node,
# clones + builds Family Calendar, and wires up the server + cage kiosk so the
# device boots straight into the QR setup screen.

REPO="${FC_REPO:-https://github.com/damdude/family-calendar.git}"
BRANCH="${FC_BRANCH:-main}"
APP_DIR="/home/pi/family-calendar"
NODE_MAJOR=22

# --- Node.js (LTS) ---
curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
apt-get install -y nodejs

# --- Clone + build as the pi user ---
if [ ! -d "$APP_DIR/.git" ]; then
	git clone --branch "$BRANCH" --depth 1 "$REPO" "$APP_DIR"
fi
chown -R 1000:1000 "$APP_DIR"

# better-sqlite3 builds from source here (armhf). Build the app now so first
# boot is fast; a first-boot unit (below) repairs it if the emulated build fails.
su - pi -c "cd '$APP_DIR' && npm ci --omit=dev && npm run build" || \
	echo "chroot build incomplete — the first-boot service will finish it."

# --- .env from example (secrets filled in later via the wizard / Settings) ---
[ -f "$APP_DIR/.env" ] || { cp "$APP_DIR/.env.example" "$APP_DIR/.env"; chown 1000:1000 "$APP_DIR/.env"; }

# --- systemd services ---
install -m 644 "$APP_DIR/deploy/family-calendar.service" /etc/systemd/system/
install -m 644 "$APP_DIR/deploy/family-calendar-cage.service" /etc/systemd/system/
install -m 644 "$APP_DIR/deploy/family-calendar-update.service" /etc/systemd/system/
install -m 644 "$APP_DIR/deploy/family-calendar-update.timer" /etc/systemd/system/
chmod +x "$APP_DIR/deploy/start-kiosk.sh" "$APP_DIR/scripts/update.sh"

# First-boot repair: ensure deps+build exist before the app starts (idempotent).
cat >/etc/systemd/system/family-calendar-firstboot.service <<'EOF'
[Unit]
Description=Family Calendar first-boot build
Before=family-calendar.service
ConditionPathExists=!/home/pi/family-calendar/build/index.js
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
User=pi
WorkingDirectory=/home/pi/family-calendar
ExecStart=/bin/bash -lc 'npm ci --omit=dev && npm run build'
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF

systemctl enable family-calendar-firstboot.service
systemctl enable family-calendar.service
systemctl enable family-calendar-cage.service
systemctl enable family-calendar-update.timer
systemctl enable seatd.service || true
usermod -aG video,render,input,seat pi || true

# Console autologin isn't needed — the cage service owns tty1 via PAMName=login.
systemctl disable getty@tty1.service || true

echo "Family Calendar baked into the image."
