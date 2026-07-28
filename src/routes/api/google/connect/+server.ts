import { error, json } from '@sveltejs/kit';
import { startDeviceFlow } from '$lib/server/google';
import type { RequestHandler } from './$types';

/** Begin the device flow — returns the code + URL to show on the Pi. */
export const POST: RequestHandler = async () => {
	try {
		const dc = await startDeviceFlow();
		return json(dc);
	} catch (e) {
		throw error(400, e instanceof Error ? e.message : 'could not start Google sign-in');
	}
};
