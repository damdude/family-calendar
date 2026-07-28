import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { removeSite } from '$lib/server/sites';
import type { RequestHandler } from './$types';

const Body = z.object({ profileId: z.number().int(), id: z.number().int() });

export const POST: RequestHandler = async ({ request }) => {
	const parsed = Body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, 'invalid request');
	await removeSite(parsed.data.profileId, parsed.data.id);
	return json({ ok: true });
};
