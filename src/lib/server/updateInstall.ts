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
import { atomicWriteFile } from './atomicWrite';

const STATE_PATH = path.join(DATA_DIR, 'update-state.json');

/** Refuses (409) if there's no pending update, so a stray/replayed call
 *  can't kick off a no-op build. */
export async function startInstallIfAvailable(): Promise<void> {
	let state: Record<string, unknown>;
	try {
		state = JSON.parse(await fsp.readFile(STATE_PATH, 'utf8'));
		if (state?.status !== 'available') {
			throw error(409, 'No update is available to install right now');
		}
	} catch (e) {
		if (e && typeof e === 'object' && 'status' in e) throw e;
		throw error(409, 'No update is available to install right now');
	}

	// Mark installing immediately, before the service has even started —
	// update.sh's own first checkpoint write is several steps (and a `git
	// fetch` over the network) away, which can take real seconds. Without
	// this, anything polling update-state.json still sees the stale
	// "available" status during that gap. Confirmed on a real device: the
	// setup wizard's Wi-Fi/pairing QR screen showed through with nothing
	// covering it in that window, looking like setup could proceed normally
	// while an install was actually already underway and about to restart
	// the server out from under it.
	try {
		await atomicWriteFile(
			STATE_PATH,
			JSON.stringify(
				{ ...state, status: 'installing', progress: 0, checkedAt: Date.now() },
				null,
				2
			)
		);
	} catch {
		/* best effort — update.sh's own writes take over moments later regardless */
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
