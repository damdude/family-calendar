#!/bin/bash
# First-boot Wi-Fi onboarding. If the Pi has no usable network, bring up a
# setup hotspot + captive portal (Balena wifi-connect) so a phone can hand over
# the home Wi-Fi credentials. Blocks until connected, then exits so the normal
# services take over. Safe to run every boot — it no-ops once online.
set -u

AP_SSID="FamilyCalendar Setup"
WC_BIN=/usr/local/sbin/wifi-connect
WC_UI=/usr/local/share/wifi-connect/ui

# Wi-Fi ships soft-blocked on a headless Pi until a regulatory domain is set,
# which stops the AP from starting. Unblock and set a conservative default
# (US = 2.4GHz ch 1-11, legal in most regions); once the family joins their own
# network 802.11d applies the correct domain. Override with WIFI_COUNTRY.
WIFI_COUNTRY="${WIFI_COUNTRY:-US}"
rfkill unblock wlan 2>/dev/null || true
iw reg set "$WIFI_COUNTRY" 2>/dev/null || true

# Wait for NetworkManager to be up (max ~30s).
for _ in $(seq 1 30); do
  nmcli -t -f RUNNING general 2>/dev/null | grep -q running && break
  sleep 1
done

# Already on a real network (Ethernet or previously-saved Wi-Fi)? Nothing to do.
state="$(nmcli -t -f CONNECTIVITY general 2>/dev/null || echo unknown)"
if [ "$state" = "full" ] || [ "$state" = "limited" ]; then
  echo "wifi-setup: already online ($state) — skipping captive portal"
  exit 0
fi

# No wifi-connect binary → can't onboard; don't loop-restart.
if [ ! -x "$WC_BIN" ]; then
  echo "wifi-setup: $WC_BIN missing — skipping" >&2
  exit 0
fi

echo "wifi-setup: offline — starting captive portal on SSID '$AP_SSID'"
exec "$WC_BIN" --portal-ssid "$AP_SSID" --ui-directory "$WC_UI"
