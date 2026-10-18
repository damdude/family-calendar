import { json } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';
import { startScheduler } from '$lib/server/cron';
import { isPinSet } from '$lib/server/pin';
import { ELEVATED_COOKIE, isValidSessionToken, SESSION_COOKIE } from '$lib/server/session';
import { logEvent } from '$lib/server/debugLog';

// Start background jobs (calendar sync, later: scrape, OTA) once on boot.
startScheduler();

// Device/network-control routes with no auth of their own: joining Wi-Fi,
// and read-only storage discovery (what NAS shares exist, how much space is
// free). The mutating storage/update actions that used to be listed here
// moved to PASSWORD_GATED_PATHS below. Everything else under /api/
// (calendar/tasks/lists/photos/config,
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
	'/api/storage/nas/browse',
	'/api/storage/nas/shares'
	// update/install, storage/migrate and storage/nas/mount used to be here
	// too. They moved to PASSWORD_GATED_PATHS below, which runs first and
	// returns before this check is ever reached for the same path -- leaving
	// them listed in both was dead weight, not defense in depth: the two
	// gates are never actually reachable to defend the same request twice.
]);

/**
 * Actions that change the device itself rather than the family's content:
 * installing new code, wiping everything, moving where data lives, mounting a
 * network share. These require the device LOGIN password — whatever it
 * currently is, the shipped default until a family changes it — re-entered
 * within the last few minutes, on whichever screen is being used (the TV's
 * on-screen keyboard or the phone).
 *
 * Unconditional: there used to be a `devicePasswordSet` config flag that
 * skipped this check entirely until a password had been chosen, on the
 * reasoning that a device still on the shipped default shouldn't demand a
 * password nobody had set yet. That flag was itself the vulnerability — it
 * lived in the same config.json a routine Settings autosave could (and did,
 * on a real device) silently reset to false, turning this whole gate off
 * with no one touching a security setting. There is no scenario where
 * skipping this is correct: the default password is a real, working Unix
 * password (verifyDevicePassword checks it via PAM/sudo, not against this
 * config), so there is always a correct value to demand. The one legitimate
 * case where no password has been chosen yet — mid first-run setup — is
 * handled by a completely separate, narrower mechanism: see
 * /api/update/install-setup, gated on a live setup pairing token instead of
 * this cookie, which stops validating the instant setup completes.
 */
const PASSWORD_GATED_PATHS = new Set([
	'/api/update/install',
	'/api/factory-reset',
	'/api/storage/migrate',
	'/api/storage/nas/mount',
	// Not destructive, but an unauthenticated POST from anything on the LAN
	// would otherwise be a standing way to interrupt the family mid-use.
	'/api/system/reboot'
]);

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export const handle: Handle = async ({ event, resolve }) => {
	const startedAt = Date.now();
	const { pathname } = event.url;
	const { method } = event.request;
	// Setup and every mutation are worth a line; routine GET polling is not,
	// or the interesting run scrolls out of the file.
	// The log endpoint must not log itself — every UI event would otherwise
	// arrive paired with a request line describing its own delivery.
	const traced =
		(pathname.startsWith('/setup') || pathname.startsWith('/api/')) &&
		pathname !== '/api/debug/log';

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
			logEvent('blocked.crossSite', { method, pathname, origin, host });
			return json({ message: 'Cross-site request blocked' }, { status: 403 });
		}
	}

	if (
		PASSWORD_GATED_PATHS.has(pathname) &&
		!isValidSessionToken(event.cookies.get(ELEVATED_COOKIE), 'elevated')
	) {
		logEvent('gate.devicePasswordRequired', { pathname });
		return json(
			{ message: 'Device password required', needsDevicePassword: true },
			{ status: 401 }
		);
	}

	if (PIN_GATED_PATHS.has(pathname) && (await isPinSet())) {
		const token = event.cookies.get(SESSION_COOKIE);
		if (!isValidSessionToken(token)) {
			logEvent('gate.pinRequired', { pathname });
			return json({ message: 'PIN required' }, { status: 401 });
		}
	}

	const response = await resolve(event);
	if (traced && (method !== 'GET' || response.status >= 400 || pathname.startsWith('/setup'))) {
		logEvent('request', {
			method,
			pathname,
			status: response.status,
			ms: Date.now() - startedAt
		});
	}
	return response;
};
