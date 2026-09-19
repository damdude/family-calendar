import { json } from '@sveltejs/kit';
import { getOverdueChores } from '$lib/server/choreReset';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const overdue = await getOverdueChores();
	return json(overdue);
};
