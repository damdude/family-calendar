import { json } from '@sveltejs/kit';
import { refreshAllSites } from '$lib/server/sites';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async () => {
	const count = await refreshAllSites();
	return json({ ok: true, count });
};
