import { json } from '@sveltejs/kit';
import { isLoopback, revealCode } from '$lib/server/recovery';
import { logEvent } from '$lib/server/debugLog';
import type { RequestHandler } from './$types';

/**
 * The code, for the kiosk to put on screen.
 *
 * Loopback only. The kiosk's browser runs on the device and reaches the
 * server at localhost, so it qualifies; a phone or laptop on the LAN arrives
 * from a routable address and does not. That is the whole security property —
 * without it the "you must be in front of the screen" proof would be
 * obtainable by anything that can reach port 5173.
 */
export const GET: RequestHandler = async ({ getClientAddress }) => {
	let address: string;
	try {
		address = getClientAddress();
	} catch {
		// Some adapters throw when they cannot determine a peer address; an
		// unknown origin is not loopback, so refuse.
		address = '';
	}
	if (!isLoopback(address)) {
		logEvent('recovery.codeRefused', { address });
		return json({ ok: false, reason: 'not-local' }, { status: 403 });
	}
	const current = revealCode();
	return json({ ok: true, active: !!current, ...(current ?? {}) });
};
