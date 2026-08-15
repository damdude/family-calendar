import { json } from '@sveltejs/kit';
import { wifiStatus, SETUP_AP_SSID } from '$lib/server/network';
import type { RequestHandler } from './$types';

/** Setup screen (online?) and the Settings/TopBar Wi-Fi status both poll this. */
export const GET: RequestHandler = async () => {
	const status = await wifiStatus();
	return json({ ...status, apSsid: SETUP_AP_SSID });
};
