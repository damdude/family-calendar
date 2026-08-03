import { json } from '@sveltejs/kit';
import { wifiDebugSnapshot } from '$lib/server/network';
import type { RequestHandler } from './$types';

/** On-screen Wi-Fi bring-up diagnostics — the setup screen's debug panel. */
export const GET: RequestHandler = async () => {
	return json({ log: await wifiDebugSnapshot(), at: Date.now() });
};
