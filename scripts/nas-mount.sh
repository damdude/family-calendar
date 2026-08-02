#!/bin/bash
# Family Calendar NAS mount helper. Runs as root via sudoers (NOPASSWD).
#
#   fc-nas-mount <host> <share> <mountpoint> <username>
#   password is read from stdin (never passed as an argument).
#
# Writes a root-only credentials file, persists the mount in /etc/fstab with
# _netdev + nofail so it comes back after a reboot, then mounts it. The data
# dir is owned by the appliance user (uid/gid 1000).
set -euo pipefail

HOST="${1:?host required}"
SHARE="${2:?share required}"
MOUNTPOINT="${3:?mountpoint required}"
USERNAME="${4:?username required}"
read -r PASSWORD || true

CRED_FILE="/etc/family-calendar-nas.cred"
UNC="//${HOST}/${SHARE}"

# Only operate under our own mount root.
case "$MOUNTPOINT" in
  /mnt/family-calendar/*) : ;;
  *) echo "refusing mountpoint outside /mnt/family-calendar" >&2; exit 2 ;;
esac

umask 077
cat > "$CRED_FILE" <<CRED
username=${USERNAME}
password=${PASSWORD}
CRED
chmod 600 "$CRED_FILE"

mkdir -p "$MOUNTPOINT"

OPTS="credentials=${CRED_FILE},_netdev,nofail,uid=1000,gid=1000,file_mode=0770,dir_mode=0770,iocharset=utf8"
FSTAB_LINE="${UNC} ${MOUNTPOINT} cifs ${OPTS} 0 0"

# Replace any existing fstab entry for this mountpoint, then append ours.
touch /etc/fstab
sed -i "\\# ${MOUNTPOINT} cifs #d" /etc/fstab
echo "$FSTAB_LINE" >> /etc/fstab

# (Re)mount.
if mountpoint -q "$MOUNTPOINT"; then
  umount "$MOUNTPOINT" || true
fi
mount "$MOUNTPOINT"
echo "mounted ${UNC} at ${MOUNTPOINT}"
