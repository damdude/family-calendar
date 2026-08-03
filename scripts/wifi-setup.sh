#!/bin/bash
# First-boot Wi-Fi onboarding. If the Pi has no usable network, bring up a
# setup hotspot + captive portal (Balena wifi-connect) so a phone can hand over
# the home Wi-Fi credentials. Blocks until connected, then exits so the normal
# services take over. Safe to run every boot — it no-ops once online.
set -u

AP_SSID="FamilyCalendar Setup"
WC_BIN=/usr/local/sbin/wifi-connect
WC_UI=/usr/local/share/wifi-connect/ui

# dhcpcd fighting NetworkManager for wlan0 is a classic cause of "AP never
# comes up" — belt-and-braces even though Bookworm defaults to NetworkManager.
if systemctl is-active --quiet dhcpcd 2>/dev/null; then
  echo "wifi-setup: stopping dhcpcd (conflicts with NetworkManager on wlan0)"
  systemctl stop dhcpcd 2>/dev/null || true
  systemctl disable dhcpcd 2>/dev/null || true
fi

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

# NetworkManager tracks its OWN software radio switch, separate from rfkill,
# persisted across boots (/var/lib/NetworkManager state). Raspberry Pi OS's
# base image ships this OFF by default (normally flipped on by the desktop's
# first-run country-selection wizard, which never runs on this headless kiosk)
# — confirmed via `nmcli radio wifi` showing "disabled" even with rfkill clear.
# Without this, wlan0 stays stuck in the "unavailable" state forever and every
# AddAndActivateConnection call for the AP fails ("device is not available").
nmcli radio wifi on 2>/dev/null || true

# Wait for NM to actually see a wifi device AND leave the "unavailable" state
# (brcmfmac firmware load + the radio-on above can both take a moment) — max ~20s.
for _ in $(seq 1 20); do
  st="$(nmcli -t -f DEVICE,TYPE,STATE device 2>/dev/null | awk -F: '$2=="wifi"{print $3}')"
  [ -n "$st" ] && [ "$st" != "unavailable" ] && break
  sleep 1
done

# Log state once for journalctl — the fastest way to diagnose a bad boot.
echo "wifi-setup: rfkill: $(rfkill list wifi 2>&1 | tr '\n' ' ')"
echo "wifi-setup: nmcli device: $(nmcli -t -f DEVICE,TYPE,STATE device 2>&1 | tr '\n' ' ')"

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
