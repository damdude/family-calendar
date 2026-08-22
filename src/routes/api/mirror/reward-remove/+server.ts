import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { isMirrorToken } from '$lib/server/mirror';
import { removeReward } from '$lib/server/familydata';
import { publishLive } from '$lib/server/live';
import type { RequestHandler } from './$types';

const Body = z.object({ token: z.string(), id: z.number().int() });

/** Phone companion → server: remove a reward from the ladder. */
export const POST: RequestHandler = async ({ request }) => {
	const parsed = Body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, 'invalid request');
	if (!isMirrorToken(parsed.data.token)) throw error(410, 'session expired');

	const ok = await removeReward(parsed.data.id);
	if (!ok) throw error(404, 'reward not found');
	publishLive();
	return json({ ok: true });
};
