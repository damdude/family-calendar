import { json } from '@sveltejs/kit';
import { GOOGLE_PROVIDER } from '$lib/server/google';
import { deleteOAuthToken } from '$lib/server/db/repo';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = ({ url }) => {
	const profileId = url.searchParams.get('profileId');
	const id = profileId ? parseInt(profileId) : undefined;
	deleteOAuthToken(GOOGLE_PROVIDER, id);
	return json({ ok: true });
};
