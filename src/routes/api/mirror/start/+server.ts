import { json } from '@sveltejs/kit';
import QRCode from 'qrcode';
import { createMirrorToken } from '$lib/server/mirror';
import { localIPv4 } from '$lib/server/net';
import type { RequestHandler } from './$types';

/** Start a mirror session: issue a token + QR the phone scans to take control. */
export const POST: RequestHandler = async ({ url }) => {
	const token = createMirrorToken();
	const ip = localIPv4();
	const port = url.port || '5173';
	const remoteUrl = `http://${ip}:${port}/remote?token=${token}`;
	const qrSvg = await QRCode.toString(remoteUrl, {
		type: 'svg',
		margin: 1,
		width: 520,
		color: { dark: '#000000', light: '#ffffff' }
	});
	return json({ token, url: remoteUrl, qrSvg });
};
