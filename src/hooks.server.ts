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

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export const handle: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;
	const { method } = event.request;

	// Every mutating /api/ route parses its body with request.json(), which
	// doesn't care what Content-Type it's labeled with — so a cross-site
	// request sent as text/plain (no CORS preflight required, unlike
	// application/json) reaches the same code path a real same-origin call
	// would. Confirmed directly: a POST to /api/config with a mismatched
	// Origin header went through and returned 200 before this check existed.
	// Browsers set Origin on every cross-origin fetch/form submission
	// themselves — page JS can't override it — so rejecting a *present,
	// mismatched* Origin blocks that without touching any legitimate
	// same-origin call this app ever makes (Origin absent is left alone
	// rather than guessed at, e.g. some direct/non-browser callers omit it).
	//
	// Compared against the request's own Host header, not event.url.origin —
	// confirmed on-device that they're not interchangeable here: this app
	// (adapter-node, HOST=0.0.0.0, no reverse proxy) never has an ORIGIN env
	// var set, and without one adapter-node's event.url.origin comes out
	// wrong, so it rejected *every* Origin a real browser could ever send,
	// including ones that genuinely matched the page's own address — the
	// phone-pairing QR silently never loaded because of it. The incoming
	// Host header is always exactly what the client actually dialed,
	// regardless of any of that.
	const host = event.request.headers.get('host');
	const origin = event.request.headers.get('origin');
	if (MUTATING_METHODS.has(method) && pathname.startsWith('/api/') && origin && host) {
		let originHost: string;
		try {
			originHost = new URL(origin).host;
		} catch {
			return json({ message: 'Cross-site request blocked' }, { status: 403 });
		}
		if (originHost !== host) {
			return json({ message: 'Cross-site request blocked' }, { status: 403 });
		}
	}

	if (PIN_GATED_PATHS.has(pathname) && (await isPinSet())) {
		const token = event.cookies.get(SESSION_COOKIE);
		if (!isValidSessionToken(token)) {
			return json({ message: 'PIN required' }, { status: 401 });
		}
	}

	return resolve(event);
};
