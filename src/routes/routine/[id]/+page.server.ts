import { loadConfig } from '$lib/server/config';
import { loadProgress } from '$lib/server/progress';
import type { PageServerLoad } from './$types';

/** This route is outside the (app) layout, so it loads config + progress itself
 *  to hydrate the store on a direct/full-page load. */
export const load: PageServerLoad = async () => {
	return { config: await loadConfig(), progress: await loadProgress() };
};
