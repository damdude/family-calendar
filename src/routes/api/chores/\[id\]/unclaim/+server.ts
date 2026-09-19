import { error, json } from '@sveltejs/kit';
import { unclaimChore } from '$lib/server/familydata';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params }) => {
	try {
		const id = parseInt(params.id);
		const chore = await unclaimChore(id);
		if (!chore) throw new Error('Chore not found');
		return json(chore);
	} catch (e) {
		throw error(400, e instanceof Error ? e.message : 'Failed to unclaim chore');
	}
};
