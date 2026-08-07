import QRCode from 'qrcode';
import { createPairing } from '$lib/server/pairing';
import { localIPv4 } from '$lib/server/net';
import { loadConfig } from '$lib/server/config';
import { isOnline, SETUP_AP_SSID } from '$lib/server/network';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const config = await loadConfig();
	const online = await isOnline();

	// Fresh token each time the kiosk opens setup (rotation).
	const { token, expiresAt } = createPairing();

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
	// The `WIFI:` scheme is understood by the iOS/Android camera. Open network.
	const wifiJoin = `WIFI:S:${SETUP_AP_SSID};T:nopass;;`;
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
