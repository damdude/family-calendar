import { getSites } from '$lib/server/sites';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const id = Number(params.id);
	const sites = Number.isInteger(id) ? ((await getSites(id))[id] ?? []) : [];
	return { sites };
};
