import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { completeChore, emptyData, loadFamilyData, saveFamilyData } from '$lib/server/familydata';
import type { RequestHandler } from './$types';

const CompleteBody = z.object({ profileId: z.number().int() });

export const POST: RequestHandler = async ({ params, request }) => {
	try {
		const body = await request.json();
		const parsed = CompleteBody.safeParse(body);
		if (!parsed.success) throw new Error('Missing profileId');

		const id = parseInt(params.id);
		const chore = await completeChore(id, parsed.data.profileId);
		if (!chore) throw new Error('Chore not found');

		// Award stars to the profile
		const data = (await loadFamilyData()) ?? emptyData();
		let starBalance = data.stars.find((s) => s.profileId === parsed.data.profileId);
		if (!starBalance) {
			starBalance = { profileId: parsed.data.profileId, stars: 0 };
			data.stars.push(starBalance);
		}
		starBalance.stars += chore.starReward;
		await saveFamilyData(data);

		return json({ chore, starsAwarded: chore.starReward });
	} catch (e) {
		throw error(400, e instanceof Error ? e.message : 'Failed to complete chore');
	}
};
