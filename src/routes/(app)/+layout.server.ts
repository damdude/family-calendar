import { loadConfig } from '$lib/server/config';
import type { LayoutServerLoad } from './$types';

/** Load persisted config so the client store can apply it (family, profiles,
 *  feature flags, orientation). Falls back to demo data when unconfigured. */
export const load: LayoutServerLoad = async () => {
	return { config: await loadConfig() };
};
