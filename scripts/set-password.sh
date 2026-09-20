#!/bin/bash
# Set the appliance user's login/SSH password. Runs as root via sudoers.
#
#   fc-set-password
#   The password is read from stdin and piped straight into chpasswd. It is
#   never a command argument, so it cannot leak through `ps`, and it is never
#   interpolated into a shell string, so it cannot be used for injection.
set -uo pipefail

DASH_USER="${FC_USER:-pi}"

IFS= read -r PASSWORD || true

if [ -z "$PASSWORD" ]; then
  echo "fc-set-password: empty password" >&2
  exit 1
fi

# chpasswd's input format is user:password, one line. `read -r` already stops
# at the first newline, so the value here cannot span lines; reject the
# remaining control characters rather than writing them into the shadow file.
case "$PASSWORD" in
  *[[:cntrl:]]*) echo "fc-set-password: unsupported password" >&2; exit 1 ;;
esac

printf '%s:%s\n' "$DASH_USER" "$PASSWORD" | chpasswd
