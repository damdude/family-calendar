import { json } from '@sveltejs/kit';
import { isOnline, SETUP_AP_SSID } from '$lib/server/network';
import type { RequestHandler } from './$types';

/** Setup screen polls this to know when the Pi has joined the home network. */
export const GET: RequestHandler = async () => {
	return json({ online: await isOnline(), apSsid: SETUP_AP_SSID });
};
