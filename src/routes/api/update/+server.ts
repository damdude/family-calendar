import { json } from '@sveltejs/kit';
import { execFileSync, spawn } from 'node:child_process';
import type { RequestHandler } from './$types';

/** Current version info: short commit + whether the tree is dirty. */
export const GET: RequestHandler = () => {
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
	return json({ commit, dirty });
};

/** Trigger an OTA update check now (via the systemd one-shot). */
export const POST: RequestHandler = () => {
	try {
		const child = spawn('systemctl', ['--no-block', 'start', 'family-calendar-update.service'], {
			stdio: 'ignore',
			detached: true
		});
		child.on('error', () => {
			/* not on a systemd host (e.g. dev) — no-op */
		});
		child.unref();
	} catch {
		/* ignore */
	}
	return json({ ok: true });
};
