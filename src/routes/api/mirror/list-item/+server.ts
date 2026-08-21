import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { isMirrorToken } from '$lib/server/mirror';
import { appendListItem } from '$lib/server/familydata';
import { publishLive } from '$lib/server/live';
import type { RequestHandler } from './$types';

const Body = z.object({
	token: z.string(),
	listId: z.number().int(),
	text: z.string().trim().min(1).max(200)
});

/** Phone companion → server: add an item to a list. */
export const POST: RequestHandler = async ({ request }) => {
	const parsed = Body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, 'invalid item');
	if (!isMirrorToken(parsed.data.token)) throw error(410, 'session expired');

	const ok = await appendListItem(parsed.data.listId, parsed.data.text);
	if (!ok) throw error(404, 'list not found');
	publishLive();
	return json({ ok: true });
};
