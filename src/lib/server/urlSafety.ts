/**
 * SSRF guard for server-side fetches of user-supplied URLs (recipe import,
 * "Sites of Interest"). Without this, anyone who can reach those endpoints
 * could make the appliance fetch arbitrary internal/LAN addresses on their
 * behalf — probing other devices on the home network, or hitting the
 * appliance's own APIs from a context that (today) has no auth check of its
 * own. Rejects everything but http/https, and refuses to connect to a
 * resolved address that's loopback/private/link-local.
 *
 * This checks the DNS answer at call time, not the address actually dialed —
 * a DNS-rebinding attacker who flips the record between this check and the
 * fetch could still slip through. Full protection would mean pinning the
 * resolved IP and dialing it directly (a custom fetch dispatcher), which is
 * more machinery than a family recipe-import feature warrants; this closes
 * the straightforward case (a URL that's simply already-private) which is
 * what actually matters for this app's threat model.
 */

import dns from 'node:dns/promises';
import net from 'node:net';

function isPrivateIp(ip: string): boolean {
	if (net.isIPv4(ip)) {
		const parts = ip.split('.').map(Number);
		const [a, b] = parts;
		if (a === 127) return true; // loopback
		if (a === 10) return true; // private
		if (a === 172 && b >= 16 && b <= 31) return true; // private
		if (a === 192 && b === 168) return true; // private
		if (a === 169 && b === 254) return true; // link-local (incl. cloud metadata)
		if (a === 0) return true;
		return false;
	}
	if (net.isIPv6(ip)) {
		const low = ip.toLowerCase();
		if (low === '::1') return true; // loopback
		if (low.startsWith('::ffff:')) return isPrivateIp(low.slice(7)); // IPv4-mapped
		if (low.startsWith('fe80:')) return true; // link-local
		if (/^f[cd][0-9a-f]{2}:/.test(low)) return true; // unique local (fc00::/7)
		return false;
	}
	return true; // unrecognized form — refuse rather than guess
}

/** Throws if `raw` isn't a fetchable public http(s) URL. Returns the parsed URL otherwise. */
export async function assertPublicHttpUrl(raw: string): Promise<URL> {
	let u: URL;
	try {
		u = new URL(raw);
	} catch {
		throw new Error('not a valid URL');
	}
	if (u.protocol !== 'http:' && u.protocol !== 'https:') {
		throw new Error('only http/https URLs are allowed');
	}
	let address: string;
	try {
		address = (await dns.lookup(u.hostname)).address;
	} catch {
		throw new Error('could not resolve that host');
	}
	if (isPrivateIp(address)) {
		throw new Error('refusing to fetch a private/internal address');
	}
	return u;
}

/**
 * fetch() with `redirect: 'follow'` checks the *original* URL and then
 * silently follows wherever the server points it — a public page can redirect
 * straight to an internal address and slip past a check done only up front.
 * This re-validates every hop instead, so a redirect chain can't be used to
 * reach a private address the initial URL wasn't allowed to touch.
 */
export async function safeFetch(
	raw: string,
	init: { headers?: Record<string, string>; signal?: AbortSignal },
	maxRedirects = 5
): Promise<Response> {
	let target = raw;
	for (let i = 0; ; i++) {
		await assertPublicHttpUrl(target);
		const res = await fetch(target, { ...init, redirect: 'manual' });
		if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
			if (i >= maxRedirects) throw new Error('too many redirects');
			target = new URL(res.headers.get('location')!, target).toString();
			continue;
		}
		return res;
	}
}
