import { loadConfig } from '$lib/server/config';
import { loadProgress } from '$lib/server/progress';
import type { LayoutServerLoad } from './$types';

/** Load persisted config + kid progress so the client store can apply them
 *  (family, profiles, feature flags, orientation; streaks, completions,
 *  feelings). Falls back to demo data when unconfigured. */
export const load: LayoutServerLoad = async () => {
	return { config: await loadConfig(), progress: await loadProgress() };
};
