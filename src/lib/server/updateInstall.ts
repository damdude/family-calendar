/**
 * Starts the OTA install service for an update a prior check already found.
 * Shared by the normal Settings "Install" action and the setup-wizard one
 * (different auth in front of each — see their +server.ts files) so the
 * "is there actually something to install" guard and the privileged spawn
 * can't drift apart between the two callers.
 */

import { error } from '@sveltejs/kit';
import { spawn } from 'node:child_process';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR } from './paths';

const STATE_PATH = path.join(DATA_DIR, 'update-state.json');

/** Refuses (409) if there's no pending update, so a stray/replayed call
 *  can't kick off a no-op build. */
export async function startInstallIfAvailable(): Promise<void> {
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
}
