#!/bin/bash
# Set the system time zone. Runs as root via sudoers.
#   fc-set-timezone <IANA-zone>
set -euo pipefail

ZONE="${1:?zone required}"

# timedatectl itself validates the zone against /usr/share/zoneinfo and
# refuses anything else, but checking first gives a clearer error than
# whatever timedatectl's own message would be, and never hands it a value
# containing shell-meaningful characters in the first place.
case "$ZONE" in
  */../*|*' '*|*[\;\|\&\$\`]*) echo "fc-set-timezone: invalid zone" >&2; exit 1 ;;
esac
[ -f "/usr/share/zoneinfo/$ZONE" ] || { echo "fc-set-timezone: unknown zone: $ZONE" >&2; exit 1; }

timedatectl set-timezone "$ZONE"
