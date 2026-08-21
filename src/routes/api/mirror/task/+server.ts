import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { isMirrorToken } from '$lib/server/mirror';
import { appendTask } from '$lib/server/familydata';
import { publishLive } from '$lib/server/live';
import type { RequestHandler } from './$types';

const Body = z.object({
	token: z.string(),
	text: z.string().trim().min(1).max(200),
	profileId: z.number().int().optional(),
	dueDate: z.string().optional()
});

/** Phone companion → server: add a task. */
export const POST: RequestHandler = async ({ request }) => {
	const parsed = Body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, 'invalid task');
	if (!isMirrorToken(parsed.data.token)) throw error(410, 'session expired');

	const { text, profileId, dueDate } = parsed.data;
	const task = await appendTask({ text, profileId, dueDate });
	publishLive();
	return json({ ok: true, task });
};
