import { error, json } from '@sveltejs/kit';
import { syncAll } from '$lib/server/sync';
import { publishLive } from '$lib/server/live';
import type { RequestHandler } from './$types';

/** Sync all calendar sources (Google + ICS links) now. */
export const POST: RequestHandler = async () => {
	try {
		const count = await syncAll();
		publishLive(); // tell the display to refresh
		return json({ ok: true, count });
	} catch (e) {
		throw error(400, e instanceof Error ? e.message : 'sync failed');
	}
};
