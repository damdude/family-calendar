import { json } from '@sveltejs/kit';
import { startRecovery } from '$lib/server/recovery';
import { logEvent } from '$lib/server/debugLog';
import type { RequestHandler } from './$types';

/**
 * Begin a recovery challenge. Open to anything on the network on purpose —
 * it hands back nothing but an expiry. The code it generates is only ever
 * shown on the display, so starting one without being in the room
 * accomplishes nothing except putting a code on a screen you cannot see.
 */
export const POST: RequestHandler = async () => {
	const { expiresAt } = startRecovery();
	logEvent('recovery.started', { expiresAt });
	return json({ ok: true, expiresAt });
};
