import { json, error } from '@sveltejs/kit';
import { listFolder } from '$lib/server/nas';
import type { RequestHandler } from './$types';

/** List the contents of a folder inside a share, so the family can navigate
 *  down to where they actually want data stored before mounting. */
export const POST: RequestHandler = async ({ request }) => {
	const { host, share, path, username, password } = await request.json().catch(() => ({}));
	if (!host || typeof host !== 'string') error(400, 'host required');
	if (!share || typeof share !== 'string') error(400, 'share required');
	return json(
		await listFolder(
			host,
			share,
			typeof path === 'string' ? path : '',
			username || undefined,
			password || undefined
		)
	);
};
