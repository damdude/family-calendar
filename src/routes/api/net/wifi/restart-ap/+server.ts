import { json } from '@sveltejs/kit';
import { restartWifiAp } from '$lib/server/network';
import type { RequestHandler } from './$types';

/** Force the setup hotspot to restart broadcasting (recovery for a stuck/failed AP). */
export const POST: RequestHandler = async () => {
	const res = await restartWifiAp();
	return json(res, { status: res.ok ? 200 : 500 });
};
