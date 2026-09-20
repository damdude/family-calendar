import { json } from '@sveltejs/kit';
import { isGoogleConfigured } from '$lib/server/google';
import { isGoogleConnected } from '$lib/server/sync';
import { getOAuthToken, getAllGoogleTokens as getAllGoogleTokensRepo } from '$lib/server/db/repo';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
	const profileId = url.searchParams.get('profileId');
	const id = profileId ? parseInt(profileId) : undefined;

	const token = getOAuthToken('google', id);
	return json({
		configured: isGoogleConfigured(),
		connected: isGoogleConnected(),
		allConnections: getAllGoogleTokensRepo().map((t) => ({
			profileId: t.profileId ?? null,
			accountEmail: t.accountEmail ?? null
		})),
		account: token?.accountEmail ?? null
	});
};
