import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { isMirrorToken } from '$lib/server/mirror';
import { addList } from '$lib/server/familydata';
import { publishLive } from '$lib/server/live';
import type { RequestHandler } from './$types';

const Body = z.object({
	token: z.string(),
	name: z.string().trim().min(1).max(60),
	kind: z.enum(['grocery', 'todo', 'packing', 'custom']),
	icon: z.string().max(8).default('📋')
});

/** Phone companion → server: create a new list. */
export const POST: RequestHandler = async ({ request }) => {
	const parsed = Body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, 'invalid list');
	if (!isMirrorToken(parsed.data.token)) throw error(410, 'session expired');

	const { name, kind, icon } = parsed.data;
	const list = await addList(name, kind, icon);
	publishLive();
	return json({ ok: true, list });
};
