import { json, error } from '@sveltejs/kit';
import { getSession } from '$lib/server/pairing';
import { pushPath } from '$lib/server/mirror';
import type { RequestHandler } from './$types';

/** The controller (phone) reports its current path; the TV will follow. */
export const POST: RequestHandler = async ({ request }) => {
	const { token, path } = await request.json().catch(() => ({}));
	if (!token || typeof path !== 'string') error(400, 'token and path required');
	if (!getSession(token)) error(410, 'session expired');
	// Only mirror in-app paths (never the pairing/remote plumbing).
	if (path.startsWith('/') && !path.startsWith('/remote') && !path.startsWith('/pair')) {
		pushPath(token, path);
	}
	return json({ ok: true });
};
