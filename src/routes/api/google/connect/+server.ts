import { error, json } from '@sveltejs/kit';
import { startDeviceFlow } from '$lib/server/google';
import type { RequestHandler } from './$types';

/** Begin the device flow for a profile — returns the code + URL to show on the Pi.
 *  Query param ?profileId=N for per-profile OAuth, or no param for shared account. */
export const POST: RequestHandler = async ({ url }) => {
	try {
		const profileId = url.searchParams.get('profileId');
		const dc = await startDeviceFlow();
		return json({ ...dc, profileId: profileId ? parseInt(profileId) : null });
	} catch (e) {
		throw error(400, e instanceof Error ? e.message : 'could not start Google sign-in');
	}
};
