import { json } from '@sveltejs/kit';
import { execFileSync, spawn } from 'node:child_process';
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
export const GET: RequestHandler = async () => {
	let commit = 'unknown';
	let dirty = false;
	try {
		commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: process.cwd() })
			.toString()
			.trim();
		dirty =
			execFileSync('git', ['status', '--porcelain'], { cwd: process.cwd() }).toString().trim()
				.length > 0;
	} catch {
		/* not a git checkout */
	}
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
