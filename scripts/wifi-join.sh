#!/bin/bash
# Join a Wi-Fi network. Runs as root via sudoers (NOPASSWD).
#
#   fc-wifi-join <ssid>
#   The password is read from stdin and written straight into a root-only
#   NetworkManager keyfile — it is never a command argument, so it cannot leak
#   through `ps` to anything else on the box.
#   An empty password means an open network.
set -uo pipefail

SSID="${1:?ssid required}"
IFS= read -r PASSWORD || true

CONN_ID="fc-wifi"
KEYFILE="/etc/NetworkManager/system-connections/${CONN_ID}.nmconnection"

# The first-boot portal owns wlan0; free it before switching to client mode.
systemctl stop family-calendar-wifi.service 2>/dev/null || true
pkill -f wifi-connect 2>/dev/null || true

# Remove any previous profile of ours (and any leftover AP-mode profile).
nmcli connection delete "$CONN_ID" >/dev/null 2>&1 || true
nmcli -t -f NAME,TYPE connection show 2>/dev/null | while IFS= read -r line; do
  type="${line##*:}"
  name="${line%:*}"
  [ "$type" = "802-11-wireless" ] || continue
  mode="$(nmcli -t -f 802-11-wireless.mode connection show "$name" 2>/dev/null)"
  [ "${mode##*:}" = "ap" ] && nmcli connection delete "$name" >/dev/null 2>&1
done

umask 077
if [ -n "$PASSWORD" ]; then
  cat > "$KEYFILE" <<EOF
[connection]
id=${CONN_ID}
type=wifi
autoconnect=true
autoconnect-priority=10

[wifi]
mode=infrastructure
ssid=${SSID}

[wifi-security]
key-mgmt=wpa-psk
psk=${PASSWORD}

[ipv4]
method=auto

[ipv6]
method=auto
EOF
else
  cat > "$KEYFILE" <<EOF
[connection]
id=${CONN_ID}
type=wifi
autoconnect=true
autoconnect-priority=10

[wifi]
mode=infrastructure
ssid=${SSID}

[ipv4]
method=auto

[ipv6]
method=auto
EOF
fi
chmod 600 "$KEYFILE"

nmcli radio wifi on 2>/dev/null || true
nmcli connection reload
nmcli --wait 45 connection up "$CONN_ID"
