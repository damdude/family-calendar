import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { isMirrorToken } from '$lib/server/mirror';
import { claimReward } from '$lib/server/familydata';
import { publishLive } from '$lib/server/live';
import type { RequestHandler } from './$types';

const Body = z.object({ token: z.string(), rewardId: z.number().int(), profileId: z.number().int() });

/** Phone companion → server: redeem a reward for a kid (deducts stars). */
export const POST: RequestHandler = async ({ request }) => {
	const parsed = Body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, 'invalid request');
	if (!isMirrorToken(parsed.data.token)) throw error(410, 'session expired');

	const ok = await claimReward(parsed.data.rewardId, parsed.data.profileId);
	if (!ok) throw error(400, 'not enough stars, or no such reward');
	publishLive();
	return json({ ok: true });
};
