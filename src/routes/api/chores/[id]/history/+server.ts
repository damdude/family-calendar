import { json } from '@sveltejs/kit';
import { getChoreHistory } from '$lib/server/familydata';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url }) => {
	const id = parseInt(params.id);
	const days = parseInt(url.searchParams.get('days') ?? '30');
	const history = await getChoreHistory(id, days);
	return json(history);
};
