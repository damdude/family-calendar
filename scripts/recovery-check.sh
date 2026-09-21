#!/bin/bash
# Boot-time recovery hatch. Runs as root from family-calendar-recovery.service.
#
# If the device password is lost, every way back in is closed at once: ssh
# needs it, and so do the update and factory-reset buttons. Without this the
# only remedy is reflashing the card and losing everything on it.
#
# The escape is a file on the BOOT partition, which is the FAT32 one any
# laptop can mount by just putting the card in:
#
#     touch /Volumes/bootfs/fc-reset-password      # macOS
#     touch /media/$USER/bootfs/fc-reset-password  # Linux
#
# This grants nothing new. Anyone who can create that file can already read
# and rewrite the whole filesystem on that card; a password check could not
# have stopped them. What it avoids is destroying the family's data to
# recover from a typo.
set -uo pipefail

DASH_USER="${FC_USER:-pi}"
DEFAULT_PASSWORD="changeme"
APP_DIR="${FC_APP_DIR:-/home/${DASH_USER}/family-calendar}"

# Bookworm mounts the firmware partition here; older images used /boot.
for BOOT in /boot/firmware /boot; do
	[ -d "$BOOT" ] || continue
	MARKER="$BOOT/fc-reset-password"
	[ -f "$MARKER" ] || continue

	printf '%s:%s\n' "$DASH_USER" "$DEFAULT_PASSWORD" | chpasswd \
		&& echo "fc-recovery: device password reset to the factory default"

	# The gate on updates and factory reset keys off this flag, so leaving it
	# true would keep demanding a password nobody knows.
	CONFIG="$APP_DIR/data/config.json"
	if [ -f "$CONFIG" ]; then
		python3 - "$CONFIG" <<'PY' || true
import json, sys
p = sys.argv[1]
try:
    with open(p) as f:
        cfg = json.load(f)
    cfg["devicePasswordSet"] = False
    tmp = p + ".tmp"
    with open(tmp, "w") as f:
        json.dump(cfg, f, indent=2)
    import os
    os.replace(tmp, p)
    print("fc-recovery: cleared devicePasswordSet")
except Exception as e:
    print("fc-recovery: could not update config:", e)
PY
		chown "${DASH_USER}:${DASH_USER}" "$CONFIG" 2>/dev/null || true
	fi

	# Leave a trace rather than deleting silently, so it is obvious this ran —
	# and so it does not fire again on every subsequent boot.
	mv -f "$MARKER" "$MARKER.done" 2>/dev/null || rm -f "$MARKER"
	break
done

exit 0
