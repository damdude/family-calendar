import { json, error } from '@sveltejs/kit';
import { listShares } from '$lib/server/nas';
import type { RequestHandler } from './$types';

/** List the shares on a server, using the provided credentials (or guest). */
export const POST: RequestHandler = async ({ request }) => {
	const { host, username, password } = await request.json().catch(() => ({}));
	if (!host || typeof host !== 'string') error(400, 'host required');
	return json(await listShares(host, username || undefined, password || undefined));
};
