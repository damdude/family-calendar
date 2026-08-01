import { redirect } from '@sveltejs/kit';
import { loadConfig } from '$lib/server/config';
import { loadProgress } from '$lib/server/progress';
import { loadFamilyData } from '$lib/server/familydata';
import { getSyncedEventsLean } from '$lib/server/db/repo';
import type { LayoutServerLoad } from './$types';

/** Load persisted config + kid progress + any synced calendar events so the
 *  client store can apply them. Falls back to demo data when unconfigured. */
export const load: LayoutServerLoad = async () => {
	const config = await loadConfig();

	// First boot / fresh device → send the display to the QR setup screen.
	if (!config.setupComplete) throw redirect(307, '/setup');

	const now = Date.now();
	const from = Math.floor((now - 21 * 86_400_000) / 1000);
	const to = Math.floor((now + 49 * 86_400_000) / 1000);
	return {
		config,
		progress: await loadProgress(),
		familyData: await loadFamilyData(),
		syncedEvents: getSyncedEventsLean(from, to)
	};
};
