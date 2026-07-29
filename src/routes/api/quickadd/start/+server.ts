import { json } from '@sveltejs/kit';
import QRCode from 'qrcode';
import { createPairing } from '$lib/server/pairing';
import { localIPv4 } from '$lib/server/net';
import type { RequestHandler } from './$types';

/** Issue a short-lived token + QR for phone quick-add. */
export const POST: RequestHandler = async ({ url }) => {
	const { token } = createPairing();
	const ip = localIPv4();
	const port = url.port || '5173';
	const addUrl = `http://${ip}:${port}/quickadd?token=${token}`;
	const qrSvg = await QRCode.toString(addUrl, {
		type: 'svg',
		margin: 1,
		width: 240,
		color: { dark: '#1a1a1a', light: '#ffffff' }
	});
	return json({ token, url: addUrl, qrSvg });
};
