import QRCode from 'qrcode';
import { createPairing, getSession } from '$lib/server/pairing';
import { localIPv4 } from '$lib/server/net';
import { loadConfig } from '$lib/server/config';
import { isOnline, SETUP_AP_SSID, setupApPassphrase } from '$lib/server/network';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, cookies }) => {
	const config = await loadConfig();
	const online = await isOnline();

	// Prevent token rotation during active phone setup: if a valid token
	// exists in a cookie, reuse it. Only create fresh tokens on first load
	// or when the prior session has expired (phone will naturally get 410).
	// This keeps the phone's QR from becoming invalid if the TV setup page
	// reloads or refreshes while they're filling out the form.
	let token: string;
	let expiresAt: number;

	const existingToken = cookies.get('_setup_token');
	const existingSession = existingToken ? getSession(existingToken) : null;

	if (existingSession && !existingSession.completed) {
		// Reuse the active token
		token = existingToken!;
		expiresAt = existingSession.createdAt + 30 * 60 * 1000;
	} else {
		// No active session; create a fresh one
		const pair = createPairing();
		token = pair.token;
		expiresAt = pair.expiresAt;
		// Store in a cookie so reloads reuse this token
		cookies.set('_setup_token', token, { path: '/setup', maxAge: 30 * 60 });
	}

	const ip = localIPv4();
	const port = url.port || '5173';
	const pairPath = `/setup/pair?token=${token}`;
	const pairUrl = `http://${ip}:${port}${pairPath}`;
	// mDNS fallback — requires avahi advertising `familycalendar.local` on the Pi
	// (wired up in Batch 6); shown as a typed alternative to the QR.
	const mdnsUrl = `http://familycalendar.local:${port}${pairPath}`;

	const qrSvg = await QRCode.toString(pairUrl, {
		type: 'svg',
		margin: 1,
		width: 300,
		color: { dark: '#1a1a1a', light: '#ffffff' }
	});

	// Phase-1 (offline): a QR that makes the phone JOIN the Pi's setup hotspot.
	// The `WIFI:` scheme is understood by the iOS/Android camera. WPA2 when
	// the AP has a passphrase (the normal case on the appliance — see
	// scripts/wifi-setup.sh); falls back to an open network only when none is
	// available (e.g. this page loading off-Pi in dev, before the AP script
	// has ever generated one).
	const psk = setupApPassphrase();
	const wifiJoin = psk
		? `WIFI:S:${SETUP_AP_SSID};T:WPA;P:${psk};;`
		: `WIFI:S:${SETUP_AP_SSID};T:nopass;;`;
	const wifiQrSvg = await QRCode.toString(wifiJoin, {
		type: 'svg',
		margin: 1,
		width: 300,
		color: { dark: '#1a1a1a', light: '#ffffff' }
	});

	return {
		token,
		expiresAt,
		pairUrl,
		mdnsUrl,
		qrSvg,
		online,
		apSsid: SETUP_AP_SSID,
		wifiQrSvg,
		displayMode: config.displayMode,
		wifiSkipped: config.wifiSkipped,
		alreadyComplete: config.setupComplete
	};
};
