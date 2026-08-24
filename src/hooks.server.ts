import { json } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';
import { startScheduler } from '$lib/server/cron';
import { isPinSet } from '$lib/server/pin';
import { isValidSessionToken, SESSION_COOKIE } from '$lib/server/session';

// Start background jobs (calendar sync, later: scrape, OTA) once on boot.
startScheduler();

// Device/network-control routes with no auth of their own: joining Wi-Fi,
// mounting a NAS share, migrating where data lives, and triggering an OTA
// install. Everything else under /api/ (calendar/tasks/lists/photos/config,
// the phone's /api/mirror/* channel) is deliberately left alone here — this
// app has no accounts, and gating the family-content routes too would lock
// the phone Settings tab out of endpoints it already calls without ever
// going through a PIN prompt (see remote/+page.svelte's pairing model — a
// scanned QR token is its own credential for those). This set is
// specifically the "someone could redirect your network or your data"
// surface a security review flagged as reachable with no auth check and no
// rate limit.
const PIN_GATED_PATHS = new Set([
	'/api/net/wifi/join',
	'/api/net/wifi/restart-ap',
	'/api/storage/check',
	'/api/storage/migrate',
	'/api/storage/nas/browse',
	'/api/storage/nas/mount',
	'/api/storage/nas/shares',
	'/api/update/install'
]);

export const handle: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;

	if (PIN_GATED_PATHS.has(pathname) && (await isPinSet())) {
		const token = event.cookies.get(SESSION_COOKIE);
		if (!isValidSessionToken(token)) {
			return json({ message: 'PIN required' }, { status: 401 });
		}
	}

	return resolve(event);
};
