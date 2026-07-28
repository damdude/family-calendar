#!/usr/bin/env bash
# Family Calendar — OTA updater with fail-safe rollback.
# Run by family-calendar-update.timer (default every 4h) or manually.
#
# Behaviour:
#   - Skip if paused (config.updates.paused) or if there are local changes.
#   - Skip if already up to date.
#   - Otherwise: back up the current build + commit, pull, install, build,
#     restart, and HEALTH-CHECK. If anything fails, roll back to the previous
#     commit + build and restart, so the appliance is never left broken.
set -uo pipefail

APP_DIR="${APP_DIR:-$HOME/family-calendar}"
URL="${HEALTHCHECK_URL:-http://localhost:5173}"
SERVICE="${SERVICE:-family-calendar}"
cd "$APP_DIR" || exit 1

log() { echo "[update $(date +%FT%T)] $*"; }

# Respect the pause flag in config.json (no jq dependency).
paused="$(node -e "try{process.stdout.write(require('./data/config.json').updates?.paused?'1':'0')}catch{process.stdout.write('0')}" 2>/dev/null || echo 0)"
if [ "$paused" = "1" ]; then log "updates paused"; exit 0; fi

# Refuse to update over local work-in-progress.
if ! git diff --quiet || ! git diff --cached --quiet; then
	log "local changes present — skipping"; exit 0
fi

git fetch --quiet origin main || { log "fetch failed"; exit 1; }
PREV="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse origin/main)"
if [ "$PREV" = "$REMOTE" ]; then log "already up to date ($PREV)"; exit 0; fi

log "updating $PREV -> $REMOTE"
rm -rf build.prev && cp -r build build.prev 2>/dev/null || true

rollback() {
	log "ROLLBACK to $PREV"
	git reset --hard "$PREV" --quiet || true
	rm -rf build
	if [ -d build.prev ]; then mv build.prev build; else npm run build || true; fi
	sudo systemctl restart "$SERVICE" || true
	exit 1
}

git pull --ff-only --quiet origin main || rollback
npm ci --omit=dev || npm install --omit=dev || rollback
npm run build || rollback
sudo systemctl restart "$SERVICE" || rollback

# Health check: the server must respond within ~30s.
ok=0
for _ in $(seq 1 15); do
	if curl -sf -o /dev/null "$URL"; then ok=1; break; fi
	sleep 2
done
if [ "$ok" != "1" ]; then log "health check failed"; rollback; fi

rm -rf build.prev
log "update complete ($REMOTE)"
