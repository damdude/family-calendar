import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { getSession } from '$lib/server/pairing';
import { startInstallIfAvailable } from '$lib/server/updateInstall';
import { logEvent } from '$lib/server/debugLog';
import type { RequestHandler } from './$types';

const Body = z.object({ token: z.string() });

/**
 * Install an update found during first-run setup — the one case where
 * /api/update/install's usual device-password gate (hooks.server.ts, now
 * unconditional) genuinely can't apply: nobody has chosen a password yet to
 * type, and the shipped default isn't shown anywhere in the wizard for
 * someone to type instead.
 *
 * A live setup pairing token is the same proof of physical presence
 * /api/pi-password already relies on for the same reason, during the same
 * window. It stops validating the instant setup completes
 * (clearPersistedSessions, called from /setup/complete), so this has no
 * reach at all once the device is actually in use.
 */
export const POST: RequestHandler = async ({ request }) => {
	const parsed = Body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, 'invalid request');
	if (!getSession(parsed.data.token)) throw error(403, 'This setup session has expired.');

	logEvent('update.installDuringSetup');
	await startInstallIfAvailable();
	return json({ ok: true });
};
