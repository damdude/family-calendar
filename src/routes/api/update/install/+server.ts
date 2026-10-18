import { json } from '@sveltejs/kit';
import { startInstallIfAvailable } from '$lib/server/updateInstall';
import type { RequestHandler } from './$types';

/** Trigger the actual OTA install (pull/build/restart) of an update a prior
 *  check found — the family's explicit "Install" tap after reading the
 *  release notes. Gated on the device password (hooks.server.ts). */
export const POST: RequestHandler = async () => {
	await startInstallIfAvailable();
	return json({ ok: true });
};
