import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { isMirrorToken } from '$lib/server/mirror';
import { appendLocalEvent } from '$lib/server/familydata';
import { publishLive } from '$lib/server/live';
import type { RequestHandler } from './$types';

const Body = z.object({
	token: z.string(),
	title: z.string().trim().min(1).max(120),
	startTs: z.number().int(),
	endTs: z.number().int(),
	allDay: z.boolean(),
	location: z.string().max(120).optional(),
	profileIds: z.array(z.number().int()).max(12).default([])
});

/** Phone companion → server: create a local event. Filed on the default
 *  shared calendar, same as the quickadd form. */
export const POST: RequestHandler = async ({ request }) => {
	const parsed = Body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, 'invalid event');
	if (!isMirrorToken(parsed.data.token)) throw error(410, 'session expired');

	const { title, startTs, endTs, allDay, location, profileIds } = parsed.data;
	const ev = await appendLocalEvent({
		title,
		startTs,
		endTs,
		allDay,
		location,
		profileIds,
		calendarId: 1
	});
	publishLive(); // tell the display to refresh
	return json({ ok: true, event: ev });
};
