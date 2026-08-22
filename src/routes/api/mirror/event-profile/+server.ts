import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { isMirrorToken } from '$lib/server/mirror';
import { setEventProfileOverride } from '$lib/server/db/repo';
import { publishLive } from '$lib/server/live';
import type { RequestHandler } from './$types';

const Body = z.object({
	token: z.string(),
	id: z.number().int(),
	profileId: z.number().int().nullable() // null clears back to the auto-resolved profile
});

/** Phone companion → server: manually reassign a synced event to a different
 *  profile (survives the next sync — see setEventProfileOverride). */
export const POST: RequestHandler = async ({ request }) => {
	const parsed = Body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, 'invalid request');
	if (!isMirrorToken(parsed.data.token)) throw error(410, 'session expired');

	const ok = setEventProfileOverride(parsed.data.id, parsed.data.profileId);
	if (!ok) throw error(404, 'event not found');
	publishLive();
	return json({ ok: true });
};
