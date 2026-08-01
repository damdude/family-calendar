#!/bin/bash -e
# ─────────────────────────────────────────────────────────────────────────────
# Family Calendar appliance stage — runs INSIDE the image chroot (natively on
# the arm64 runner). Mirrors the proven home-display kiosk setup:
#   Node → build the app → server service → console autologin → labwc (Wayland)
#   on tty1 → seatd → Chromium kiosk service (waits for wayland + server).
# The Pi then boots straight into the dashboard, which redirects to the QR
# setup screen until the family completes setup.
# ─────────────────────────────────────────────────────────────────────────────

DASH_USER=pi
USER_UID=1000
USER_HOME=/home/pi
APP_DIR="${USER_HOME}/family-calendar"
REPO="${FC_REPO:-https://github.com/damdude/family-calendar.git}"
BRANCH="${FC_BRANCH:-main}"

export DEBIAN_FRONTEND=noninteractive

# --- Node.js LTS (NodeSource) ---
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
  apt-get install -y nodejs
fi

# --- Clone + build the app (native arm64 — better-sqlite3 compiles here) ---
if [ ! -d "${APP_DIR}/.git" ]; then
  git clone --depth 1 -b "${BRANCH}" "${REPO}" "${APP_DIR}"
fi
chown -R "${DASH_USER}:${DASH_USER}" "${APP_DIR}"
sudo -u "${DASH_USER}" bash -lc "cd '${APP_DIR}' && npm ci --omit=dev && npm run build"
[ -f "${APP_DIR}/.env" ] || { cp "${APP_DIR}/.env.example" "${APP_DIR}/.env"; chown "${DASH_USER}:${DASH_USER}" "${APP_DIR}/.env"; }

# --- Server service (Node adapter → `node build`, port 5173) ---
cat > /etc/systemd/system/family-calendar.service <<UNIT
[Unit]
Description=Family Calendar dashboard server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${DASH_USER}
WorkingDirectory=${APP_DIR}
Environment=NODE_ENV=production
Environment=PORT=5173
Environment=HOST=0.0.0.0
EnvironmentFile=-${APP_DIR}/.env
ExecStart=/usr/bin/node ${APP_DIR}/build
Restart=on-failure
RestartSec=5
SyslogIdentifier=family-calendar

[Install]
WantedBy=multi-user.target
UNIT

# --- Chromium kiosk service (waits for the Wayland socket + the server) ---
cat > /etc/systemd/system/family-calendar-kiosk.service <<UNIT
[Unit]
Description=Family Calendar Chromium kiosk
After=graphical.target family-calendar.service
Wants=graphical.target
BindsTo=family-calendar.service

[Service]
Type=simple
User=${DASH_USER}
Environment=WAYLAND_DISPLAY=wayland-0
Environment=XDG_RUNTIME_DIR=/run/user/${USER_UID}
ExecStartPre=/bin/bash -c 'for i in \$(seq 1 30); do [ -S /run/user/${USER_UID}/wayland-0 ] && exit 0; sleep 1; done; exit 1'
ExecStartPre=/bin/bash -c 'for i in \$(seq 1 60); do curl -sf http://localhost:5173 >/dev/null 2>&1 && exit 0; sleep 1; done; exit 1'
ExecStart=/bin/bash -c 'CHROME=\$(command -v chromium-browser || command -v chromium); \
  exec "\$CHROME" --kiosk --ozone-platform=wayland --noerrdialogs --disable-infobars \
    --no-first-run --disable-session-crashed-bubble --disable-restore-session-state \
    --disable-pinch --check-for-update-interval=31536000 --password-store=basic \
    http://localhost:5173'
Restart=on-failure
RestartSec=10
SyslogIdentifier=family-calendar-kiosk

[Install]
WantedBy=graphical.target
UNIT

# --- OTA update units (from the repo) ---
install -m 644 "${APP_DIR}/deploy/family-calendar-update.service" /etc/systemd/system/ 2>/dev/null || true
install -m 644 "${APP_DIR}/deploy/family-calendar-update.timer" /etc/systemd/system/ 2>/dev/null || true
chmod +x "${APP_DIR}/scripts/update.sh" 2>/dev/null || true

# --- Passwordless sudo for service control (Settings restart / OTA / migrate) ---
cat > /etc/sudoers.d/family-calendar <<SUDO
${DASH_USER} ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart family-calendar, \
  /usr/bin/systemctl restart family-calendar-kiosk, \
  /usr/bin/systemctl start family-calendar-update.service, \
  /usr/bin/systemctl start --no-block family-calendar-update.service, \
  /usr/bin/systemctl reboot, /sbin/reboot
SUDO
chmod 440 /etc/sudoers.d/family-calendar
visudo -cf /etc/sudoers.d/family-calendar >/dev/null

# --- Console autologin on tty1 ---
mkdir -p /etc/systemd/system/getty@tty1.service.d
cat > /etc/systemd/system/getty@tty1.service.d/autologin.conf <<GETTY
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin ${DASH_USER} --noclear %I \$TERM
GETTY

# --- Start labwc (Wayland) on tty1 login ---
PROFILE="${USER_HOME}/.bash_profile"
if ! grep -q 'exec dbus-run-session -- labwc' "${PROFILE}" 2>/dev/null; then
  cat >> "${PROFILE}" <<'PROF'

# Start the Wayland kiosk compositor on the primary console
if [ "$(tty)" = "/dev/tty1" ] && [ -z "$WAYLAND_DISPLAY" ]; then
  export XDG_RUNTIME_DIR="/run/user/$(id -u)"
  exec dbus-run-session -- labwc
fi
PROF
fi
chown "${DASH_USER}:${DASH_USER}" "${PROFILE}"

# labwc autostart: keep the screen awake (kiosk owns the display).
LABWC_DIR="${USER_HOME}/.config/labwc"
mkdir -p "${LABWC_DIR}"
cat > "${LABWC_DIR}/autostart" <<'LABWC'
# Disable screen blanking / DPMS on the kiosk.
LABWC
chown -R "${DASH_USER}:${DASH_USER}" "${USER_HOME}/.config"

# seatd lets labwc open DRM/input without a full display manager.
usermod -aG seat,video,input,render "${DASH_USER}" 2>/dev/null || true

# --- Enable everything ---
systemctl enable seatd.service >/dev/null 2>&1 || true
systemctl enable family-calendar.service >/dev/null 2>&1 || true
systemctl enable family-calendar-kiosk.service >/dev/null 2>&1 || true
systemctl enable family-calendar-update.timer >/dev/null 2>&1 || true
systemctl set-default graphical.target >/dev/null 2>&1 || true

echo "==> Family Calendar appliance stage complete — boots into the kiosk."
