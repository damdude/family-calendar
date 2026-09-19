import { json } from '@sveltejs/kit';
import { getAllChoreStats } from '$lib/server/familydata';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const stats = await getAllChoreStats();
	return json(stats);
};
