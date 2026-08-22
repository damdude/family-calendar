import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { isMirrorToken } from '$lib/server/mirror';
import { saveReward } from '$lib/server/familydata';
import { publishLive } from '$lib/server/live';
import type { RequestHandler } from './$types';

const Body = z.object({
	token: z.string(),
	id: z.number().int().optional(), // present = edit, absent = add
	name: z.string().trim().min(1).max(120),
	icon: z.string().min(1).max(8),
	starCost: z.number().int().min(1).max(1000),
	active: z.boolean().default(true)
});

/** Phone companion → server: add or edit a reward on the ladder. */
export const POST: RequestHandler = async ({ request }) => {
	const parsed = Body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, 'invalid reward');
	if (!isMirrorToken(parsed.data.token)) throw error(410, 'session expired');

	const { id, name, icon, starCost, active } = parsed.data;
	try {
		const reward = await saveReward({ id, name, icon, starCost, active });
		publishLive();
		return json({ ok: true, reward });
	} catch {
		throw error(404, 'reward not found');
	}
};
