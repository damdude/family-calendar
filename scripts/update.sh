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

rollback() {
	log "ROLLBACK to $PREV"
	git reset --hard "$PREV" --quiet || true
	rm -rf build
	if [ -d build.prev ]; then mv build.prev build; else npm run build || true; fi
	sudo systemctl restart "$SERVICE" || true
	exit 1
}

if [ -z "${FC_UPDATE_REEXEC:-}" ]; then
	# First pass: everything up to and including the pull. Re-exec afterward
	# so install/build/restart run from a freshly-read copy of this very
	# script instead of a stale in-memory one — bash can buffer a running
	# script's remaining lines, so when THIS script updates itself via the
	# git pull below, lines after it can keep executing the pre-pull logic
	# against the just-pulled commit. Confirmed on-device: a change to the
	# install step here didn't take effect on the run that pulled it in,
	# only on the next one — silently re-breaking the very thing it fixed.
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

	git pull --ff-only --quiet origin main || rollback

	FC_UPDATE_REEXEC=1 FC_UPDATE_PREV="$PREV" FC_UPDATE_REMOTE="$REMOTE" exec bash "$0"
fi

PREV="$FC_UPDATE_PREV"
REMOTE="${FC_UPDATE_REMOTE:-}"

# Full install (incl. devDependencies): vite/@sveltejs/kit live there and the
# build step needs them. Pruned back down to production-only after building,
# matching how the base image itself is provisioned.
npm ci || npm install || rollback
# better-sqlite3's prebuilt linux-arm64 binary needs a newer glibc than
# Raspberry Pi OS ships, so installing it as-is breaks every DB-backed route
# with a dlopen error. .npmrc sets build-from-source=true, but `npm ci` was
# confirmed on-device to still pull the prebuilt binary regardless (finishes
# in ~25s — nowhere near long enough to have actually compiled it) — so it's
# rebuilt explicitly afterward instead of trusted to npm ci. The existing
# prebuilds/ dir has to go first: `npm rebuild` finds it already "installed"
# and skips straight past the compile step otherwise, silently leaving the
# broken prebuilt binary in place despite reporting success.
#
# Ignore node-gyp's own exit code here: it was observed on-device returning a
# nonzero status from a post-build cache cleanup step (an ENOENT lstat on
# node_gyp_bins) *after* successfully compiling and linking the binary — a
# false failure signal. What actually matters is whether the module loads,
# so that's checked directly instead of trusting the exit code.
rm -rf node_modules/better-sqlite3/build node_modules/better-sqlite3/prebuilds
npm_config_build_from_source=true npm rebuild better-sqlite3 || true
node -e "new (require('better-sqlite3'))(':memory:')" || rollback
npm run build || rollback
npm prune --omit=dev || true
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
