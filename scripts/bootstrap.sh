#!/usr/bin/env bash
# Family Calendar — one-line bootstrap.
#
#   curl -fsSL https://raw.githubusercontent.com/damdude/family-calendar/main/scripts/bootstrap.sh | bash
#
# Clones the repo (or updates it) into ~/family-calendar and runs the installer.
set -euo pipefail

REPO="${FC_REPO:-https://github.com/damdude/family-calendar.git}"
DIR="${FC_DIR:-$HOME/family-calendar}"

echo "==> Family Calendar bootstrap"

if ! command -v git >/dev/null 2>&1; then
	sudo apt-get update && sudo apt-get install -y git
fi

if [ -d "$DIR/.git" ]; then
	echo "==> Updating existing checkout in $DIR"
	git -C "$DIR" pull --ff-only
else
	echo "==> Cloning into $DIR"
	git clone "$REPO" "$DIR"
fi

exec bash "$DIR/scripts/install.sh"
