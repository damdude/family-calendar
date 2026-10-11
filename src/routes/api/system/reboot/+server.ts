import { error, json } from '@sveltejs/kit';
import { spawn } from 'node:child_process';
import { logEvent } from '$lib/server/debugLog';
import type { RequestHandler } from './$types';

/**
 * Restart the device. Gated on the device password (see hooks.server.ts) —
 * not because a reboot is destructive, but because an unauthenticated POST
 * from anything on the LAN would otherwise be a standing way to interrupt
 * whatever the family is doing on the screen at that moment.
 */
export const POST: RequestHandler = async () => {
	logEvent('system.reboot');
	try {
		const child = spawn('sudo', ['systemctl', 'reboot'], { stdio: 'ignore', detached: true });
		child.on('error', () => {
			/* not a systemd host (dev machine) — the catch below still returns ok */
		});
		child.unref();
	} catch (err) {
		throw error(500, err instanceof Error ? err.message : 'Could not restart the device.');
	}
	return json({ ok: true });
};
