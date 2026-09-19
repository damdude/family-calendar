import { error, json } from '@sveltejs/kit';
import { getChoreById, upsertChore, deleteChore } from '$lib/server/familydata';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const id = parseInt(params.id);
	const chore = await getChoreById(id);
	if (!chore) throw error(404, 'Chore not found');
	return json(chore);
};

export const PUT: RequestHandler = async ({ params, request }) => {
	try {
		const id = parseInt(params.id);
		const body = await request.json();
		const chore = await upsertChore({ ...body, id });
		return json(chore);
	} catch (e) {
		throw error(400, e instanceof Error ? e.message : 'Failed to update chore');
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	const id = parseInt(params.id);
	const success = await deleteChore(id);
	if (!success) throw error(404, 'Chore not found');
	return json({ ok: true });
};
