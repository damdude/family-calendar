import { error, json } from '@sveltejs/kit';
import { syncGoogle } from '$lib/server/sync';
import type { RequestHandler } from './$types';

/** Manual "sync now". */
export const POST: RequestHandler = async () => {
	try {
		const count = await syncGoogle();
		return json({ ok: true, count });
	} catch (e) {
		throw error(400, e instanceof Error ? e.message : 'sync failed');
	}
};
