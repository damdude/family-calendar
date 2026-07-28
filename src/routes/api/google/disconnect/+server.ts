import { json } from '@sveltejs/kit';
import { GOOGLE_PROVIDER } from '$lib/server/google';
import { deleteOAuthToken } from '$lib/server/db/repo';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = () => {
	deleteOAuthToken(GOOGLE_PROVIDER);
	return json({ ok: true });
};
