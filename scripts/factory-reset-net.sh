#!/bin/bash
# Forget every network this appliance has joined. Runs as root via sudoers.
#
#   fc-factory-reset-net
#
# Wi-Fi credentials are NOT app data — NetworkManager stores them in
# /etc/NetworkManager/system-connections/, which the factory reset in the app
# cannot reach. Without this the device keeps rejoining the family's network
# after a "reset to factory" and is plainly not fresh.
#
# Deliberately removes only wireless profiles: a wired connection is how a
# bench/recovery setup reaches the device, and dropping it too would strand a
# Pi that has no Wi-Fi configured yet.
set -uo pipefail

# Stop the onboarding portal first if it happens to be running, so it doesn't
# race us by recreating an AP profile while we're deleting them.
systemctl stop family-calendar-wifi.service 2>/dev/null || true
pkill -f wifi-connect 2>/dev/null || true

# Terse output is NAME:TYPE, and a profile name may itself contain an escaped
# colon, so split on the LAST separator.
nmcli -t -f NAME,TYPE connection show 2>/dev/null | while IFS= read -r line; do
  [ -n "$line" ] || continue
  type="${line##*:}"
  name="${line%:*}"
  [ "$type" = "802-11-wireless" ] || continue
  nmcli connection delete "$name" >/dev/null 2>&1 \
    && echo "fc-factory-reset-net: removed $name"
done

# Anything left behind by a crash or a hand-edited file.
rm -f /etc/NetworkManager/system-connections/fc-wifi.nmconnection 2>/dev/null || true

# The passphrase the setup hotspot advertises in its QR is regenerated on the
# next onboarding run; a stale one would be shown on screen but not accepted.
rm -f /etc/family-calendar/setup-ap-psk 2>/dev/null || true

exit 0
