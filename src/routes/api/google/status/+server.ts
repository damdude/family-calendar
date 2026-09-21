import { json } from '@sveltejs/kit';
import { isGoogleConfigured } from '$lib/server/google';
import { isGoogleConnected } from '$lib/server/sync';
import { getOAuthToken, getAllGoogleTokens as getAllGoogleTokensRepo } from '$lib/server/db/repo';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
	const profileId = url.searchParams.get('profileId');
	const id = profileId ? parseInt(profileId) : undefined;

	const token = getOAuthToken('google', id);
	// Masked so the two ends can be compared against the Google console
	// without reading the whole value off a screen. A client ID is public by
	// design in OAuth, and this is a LAN-only appliance, but there is still no
	// reason to print more of it than a comparison needs.
	const rawId = process.env.GOOGLE_OAUTH_CLIENT_ID ?? '';
	const clientIdMasked = rawId
		? `${rawId.slice(0, 8)}…${rawId.slice(-16)} (len ${rawId.length})`
		: null;

	return json({
		configured: isGoogleConfigured(),
		clientIdMasked,
		clientSecretSet: !!process.env.GOOGLE_OAUTH_CLIENT_SECRET,
		connected: isGoogleConnected(),
		allConnections: getAllGoogleTokensRepo().map((t) => ({
			profileId: t.profileId ?? null,
			accountEmail: t.accountEmail ?? null
		})),
		account: token?.accountEmail ?? null
	});
};
