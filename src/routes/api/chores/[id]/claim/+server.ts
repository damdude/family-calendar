import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { claimChore } from '$lib/server/familydata';
import type { RequestHandler } from './$types';

const ClaimBody = z.object({ profileId: z.number().int() });

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const body = await request.json();
		const parsed = ClaimBody.safeParse(body);
		if (!parsed.success) throw new Error('Missing profileId');

		const id = parseInt(params.id);
		const chore = await claimChore(id, parsed.data.profileId);
		if (!chore) throw new Error('Chore not found');
		return json(chore);
	} catch (e) {
		throw error(400, e instanceof Error ? e.message : 'Failed to claim chore');
	}
};
