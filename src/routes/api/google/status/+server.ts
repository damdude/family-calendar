import { json } from '@sveltejs/kit';
import { isGoogleConfigured } from '$lib/server/google';
import { isGoogleConnected } from '$lib/server/sync';
import { getOAuthToken } from '$lib/server/db/repo';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
	return json({
		configured: isGoogleConfigured(),
		connected: isGoogleConnected(),
		account: getOAuthToken('google')?.accountEmail ?? null
	});
};
