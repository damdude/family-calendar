import { error, json } from '@sveltejs/kit';
import { spawn } from 'node:child_process';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR } from '$lib/server/paths';
import type { RequestHandler } from './$types';

const STATE_PATH = path.join(DATA_DIR, 'update-state.json');

/** Trigger the actual OTA install (pull/build/restart) of an update a prior
 *  check found — the family's explicit "Install" tap after reading the
 *  release notes. Refuses if there's no pending update to install, so a
 *  stray click can't kick off a no-op build. */
export const POST: RequestHandler = async () => {
	try {
		const raw = await fsp.readFile(STATE_PATH, 'utf8');
		const state = JSON.parse(raw);
		if (state?.status !== 'available') {
			throw error(409, 'No update is available to install right now');
		}
	} catch (e) {
		if (e && typeof e === 'object' && 'status' in e) throw e;
		throw error(409, 'No update is available to install right now');
	}

	try {
		const child = spawn(
			'sudo',
			['systemctl', 'start', '--no-block', 'family-calendar-install.service'],
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
