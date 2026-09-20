import { json } from '@sveltejs/kit';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR } from '$lib/server/paths';
import type { RequestHandler } from './$types';

const STATE_PATH = path.join(DATA_DIR, 'update-state.json');

export interface UpdateState {
	status: 'idle' | 'available' | 'installing' | 'failed';
	currentCommit?: string;
	targetCommit?: string;
	notes?: string[];
	error?: string;
	progress?: number;
	installedAt?: number;
	checkedAt?: number;
}

async function readUpdateState(): Promise<UpdateState | null> {
	try {
		return JSON.parse(await fsp.readFile(STATE_PATH, 'utf8'));
	} catch {
		return null;
	}
}

/** Current version info + any pending-update state a `check` run left
 *  behind (see scripts/update.sh) — the phone/desktop Settings page polls
 *  this to show "update available" with release notes, an install in
 *  progress, or a failure. */
const execFileAsync = promisify(execFile);

/**
 * Version info is cached briefly because the Settings page polls this every
 * five seconds while it's open. The previous implementation shelled out to
 * git TWICE per request with execFileSync, which blocks the event loop — on a
 * Pi that meant the whole server stalling on a subprocess on a 5s cycle, and
 * `git status --porcelain` is not cheap on a working tree this size. The
 * commit only changes when an update installs, which restarts the service
 * anyway, so a short TTL costs nothing in accuracy.
 */
const VERSION_TTL_MS = 30_000;
let versionCache: { at: number; commit: string; dirty: boolean } | null = null;

async function gitVersion(): Promise<{ commit: string; dirty: boolean }> {
	const now = Date.now();
	if (versionCache && now - versionCache.at < VERSION_TTL_MS) {
		return { commit: versionCache.commit, dirty: versionCache.dirty };
	}
	let commit = 'unknown';
	let dirty = false;
	try {
		const [rev, status] = await Promise.all([
			execFileAsync('git', ['rev-parse', '--short', 'HEAD'], { cwd: process.cwd() }),
			execFileAsync('git', ['status', '--porcelain'], { cwd: process.cwd() })
		]);
		commit = rev.stdout.trim();
		dirty = status.stdout.trim().length > 0;
	} catch {
		/* not a git checkout */
	}
	versionCache = { at: now, commit, dirty };
	return { commit, dirty };
}

export const GET: RequestHandler = async () => {
	const { commit, dirty } = await gitVersion();
	return json({ commit, dirty, update: await readUpdateState() });
};

/** Trigger an OTA update CHECK now (fetch + compare only, never installs —
 *  see scripts/update.sh). `sudo` matters here: starting a systemd unit as
 *  a plain (non-root) user requires polkit authorization even when sudoers
 *  grants the user NOPASSWD access to the underlying `systemctl` command —
 *  those are two different privilege paths, and skipping `sudo` fails
 *  silently (spawn itself succeeds; only the systemctl call inside it gets
 *  rejected with "Interactive authentication required"). Confirmed on-
 *  device as exactly why "check for updates" looked like it never did
 *  anything: the API call always returned {ok:true} regardless. */
export const POST: RequestHandler = () => {
	try {
		const child = spawn(
			'sudo',
			['systemctl', 'start', '--no-block', 'family-calendar-update.service'],
			{ stdio: 'ignore', detached: true }
		);
		child.on('error', () => {
			/* not on a systemd host (e.g. dev) — no-op */
		});
		child.unref();
	} catch {
		/* ignore */
	}
	return json({ ok: true });
};
