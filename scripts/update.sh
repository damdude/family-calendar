#!/usr/bin/env bash
# Family Calendar — OTA updater, two-step (check, then install) with
# fail-safe rollback.
#
# Modes:
#   check    (default) — fetch + compare only. Never touches the working
#            tree, never builds, never restarts. Writes data/update-state.json
#            (status/currentCommit/targetCommit/notes) so the UI can show
#            "update available" with release notes and an Install button.
#   install  — actually pull/build/restart the update a prior `check` found.
#            Re-verifies against origin first (the check could be stale).
#            Refuses if free disk space is too low. Backs up the current
#            build + commit and rolls back on any failure, so a bad update
#            never leaves the appliance broken.
#
# Run by family-calendar-update.timer (weekly `check`) or on demand via
# POST /api/update (check) and POST /api/update/install (install).
set -uo pipefail

MODE="${1:-check}"
APP_DIR="${APP_DIR:-$HOME/family-calendar}"
# /api/config, not just / — the static shell can return 200 from a build
# whose server-side code is actually broken (confirmed on-device: a missing
# node_modules/zod after `npm prune` 500'd every API route while / kept
# serving fine, so this check let a broken deploy report "healthy").
# loadConfig() itself never throws (falls back to defaults on any read/parse
# error), so a 500 here means a real server-side fault, not a first-boot
# empty-config false positive.
URL="${HEALTHCHECK_URL:-http://localhost:5173/api/config}"
SERVICE="${SERVICE:-family-calendar}"
STATE_FILE="$APP_DIR/data/update-state.json"
MIN_FREE_MB="${MIN_FREE_MB:-512}"
cd "$APP_DIR" || exit 1

log() { echo "[update $(date +%FT%T)] $*"; }

# Writes data/update-state.json. Args: status current target notes(newline-
# joined subjects) error progress(0-100) installed(1 on a just-completed
# install, else blank). Passed via env vars (not argv) so commit subjects
# with quotes/special characters can't break shell parsing.
write_state() {
	FC_STATUS="$1" FC_CURRENT="${2:-}" FC_TARGET="${3:-}" FC_NOTES="${4:-}" FC_ERROR="${5:-}" FC_PROGRESS="${6:-}" FC_INSTALLED="${7:-}" \
		node -e '
			const fs = require("fs");
			const notes = process.env.FC_NOTES ? process.env.FC_NOTES.split("\n").filter(Boolean) : [];
			// installedAt only ever moves forward on a completed install (the
			// final write_state call of a successful run) — every other call
			// (checks, "installing" progress ticks, failures) carries the
			// previous value forward so "last updated" reflects the last
			// successful install, not the last check or attempt.
			let installedAt;
			try {
				installedAt = JSON.parse(fs.readFileSync("data/update-state.json", "utf8")).installedAt;
			} catch {}
			if (process.env.FC_INSTALLED === "1") installedAt = Date.now();
			const state = {
				status: process.env.FC_STATUS,
				currentCommit: process.env.FC_CURRENT || undefined,
				targetCommit: process.env.FC_TARGET || undefined,
				notes,
				error: process.env.FC_ERROR || undefined,
				progress: process.env.FC_PROGRESS ? Number(process.env.FC_PROGRESS) : undefined,
				installedAt,
				checkedAt: Date.now()
			};
			fs.mkdirSync("data", { recursive: true });
			fs.writeFileSync("data/update-state.json.tmp", JSON.stringify(state, null, 2));
			fs.renameSync("data/update-state.json.tmp", "data/update-state.json");
		' 2>/dev/null || true
}

# Progress checkpoints during install — coarse (per major step, not
# per-line-of-build-output) since neither npm nor vite expose a reliable
# percentage, but real: each number reflects a step that actually finished,
# weighted roughly by how long each one takes on Pi hardware (the build step
# dominates). Keeps status/current/target/notes as they already were.
write_progress() {
	write_state "installing" "$PREV" "${REMOTE:-}" "" "" "$1"
}

CURRENT="$(git rev-parse HEAD)"

if [ "$MODE" = "check" ]; then
	# npm ci regenerates package-lock.json on-device (differs from the Mac-
	# generated lockfile committed upstream), leaving it modified after every
	# install — discard that before it's mistaken for real work in progress.
	git checkout -- package-lock.json 2>/dev/null || true
	git fetch --quiet origin main || {
		log "fetch failed"
		write_state "failed" "$CURRENT" "" "" "Could not reach GitHub"
		exit 1
	}
	REMOTE="$(git rev-parse origin/main)"
	if [ "$CURRENT" = "$REMOTE" ]; then
		log "already up to date ($CURRENT)"
		write_state "idle" "$CURRENT"
		exit 0
	fi
	NOTES="$(git log --format='%s' "$CURRENT..$REMOTE")"
	log "update available: $CURRENT -> $REMOTE"
	write_state "available" "$CURRENT" "$REMOTE" "$NOTES"
	exit 0
fi

if [ "$MODE" != "install" ]; then
	log "unknown mode: $MODE"
	exit 1
fi

# --- install ---
rollback() {
	log "ROLLBACK to $PREV"
	git reset --hard "$PREV" --quiet || true
	rm -rf build
	if [ -d build.prev ]; then mv build.prev build; else npm run build || true; fi
	sudo systemctl restart "$SERVICE" || true
	write_state "failed" "$PREV" "${REMOTE:-}" "" "Update failed — rolled back to the previous version"
	exit 1
}

if [ -z "${FC_UPDATE_REEXEC:-}" ]; then
	paused="$(node -e "try{process.stdout.write(require('./data/config.json').updates?.paused?'1':'0')}catch{process.stdout.write('0')}" 2>/dev/null || echo 0)"
	if [ "$paused" = "1" ]; then
		log "updates paused"
		exit 0
	fi

	git checkout -- package-lock.json 2>/dev/null || true

	# Refuse to update over local work-in-progress.
	if ! git diff --quiet || ! git diff --cached --quiet; then
		log "local changes present — skipping"
		write_state "failed" "$CURRENT" "" "" "Local changes present on the device — skipped"
		exit 0
	fi

	git fetch --quiet origin main || {
		log "fetch failed"
		write_state "failed" "$CURRENT" "" "" "Could not reach GitHub"
		exit 1
	}
	PREV="$(git rev-parse HEAD)"
	REMOTE="$(git rev-parse origin/main)"
	if [ "$PREV" = "$REMOTE" ]; then
		log "already up to date ($PREV)"
		write_state "idle" "$PREV"
		exit 0
	fi

	# A failed install from a full disk is worse than no update at all — npm
	# and the build can leave the tree half-written. Require enough headroom
	# for a second copy of build/ during the swap, plus normal slack.
	FREE_MB="$(df -Pm "$APP_DIR" | tail -1 | awk '{print $4}')"
	if [ "${FREE_MB:-0}" -lt "$MIN_FREE_MB" ]; then
		log "not enough free space (${FREE_MB}MB < ${MIN_FREE_MB}MB) — refusing to install"
		write_state "failed" "$PREV" "$REMOTE" "" "Not enough free space (${FREE_MB}MB available, ${MIN_FREE_MB}MB required)"
		exit 1
	fi

	log "installing $PREV -> $REMOTE"
	write_state "installing" "$PREV" "$REMOTE" "" "" 5
	rm -rf build.prev && cp -r build build.prev 2>/dev/null || true

	git pull --ff-only --quiet origin main || rollback

	# Re-exec afterward so install/build/restart run from a freshly-read copy
	# of this very script instead of a stale in-memory one — bash can buffer
	# a running script's remaining lines, so when THIS script updates itself
	# via the git pull above, lines after it can keep executing the pre-pull
	# logic against the just-pulled commit. Confirmed on-device: a change to
	# the install step here didn't take effect on the run that pulled it in,
	# only on the next one — silently re-breaking the very thing it fixed.
	FC_UPDATE_REEXEC=1 FC_UPDATE_PREV="$PREV" FC_UPDATE_REMOTE="$REMOTE" exec bash "$0" install
fi

PREV="$FC_UPDATE_PREV"
REMOTE="${FC_UPDATE_REMOTE:-}"
write_progress 10

# Full install (incl. devDependencies): vite/@sveltejs/kit live there and the
# build step needs them. Pruned back down to production-only after building,
# matching how the base image itself is provisioned.
npm ci || npm install || rollback
write_progress 30
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
write_progress 45
npm run build || rollback
write_progress 85
npm prune --omit=dev || true
sudo systemctl restart "$SERVICE" || rollback
write_progress 95

# Health check: the server must respond within ~30s.
ok=0
for _ in $(seq 1 15); do
	if curl -sf -o /dev/null "$URL"; then
		ok=1
		break
	fi
	sleep 2
done
if [ "$ok" != "1" ]; then
	log "health check failed"
	rollback
fi

rm -rf build.prev
log "update complete ($REMOTE)"
write_state "idle" "$REMOTE" "" "" "" 100 1
