import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { getSession } from '$lib/server/pairing';
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

/** Phone → server: create a local event via a valid quick-add token. */
export const POST: RequestHandler = async ({ request }) => {
	const parsed = Body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, 'invalid event');
	if (!getSession(parsed.data.token)) throw error(410, 'This add link has expired.');

	const { title, startTs, endTs, allDay, location, profileIds } = parsed.data;
	// Quick-add always files into the default shared calendar — picking a
	// specific one isn't worth the extra tap on a phone quick-add form.
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
