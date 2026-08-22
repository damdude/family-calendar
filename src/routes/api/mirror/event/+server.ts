import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { isMirrorToken } from '$lib/server/mirror';
import { appendLocalEvent, updateLocalEvent } from '$lib/server/familydata';
import { publishLive } from '$lib/server/live';
import type { RequestHandler } from './$types';

const Body = z.object({
	token: z.string(),
	id: z.number().int().optional(), // present = edit an existing local event
	title: z.string().trim().min(1).max(120),
	startTs: z.number().int(),
	endTs: z.number().int(),
	allDay: z.boolean(),
	location: z.string().max(120).optional(),
	profileIds: z.array(z.number().int()).max(12).default([]),
	calendarId: z.number().int().default(1)
});

/** Phone companion → server: create or edit a local event (id present =
 *  edit — this is also how an event moves to a different local calendar or
 *  gets reassigned to a different profile). */
export const POST: RequestHandler = async ({ request }) => {
	const parsed = Body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, 'invalid event');
	if (!isMirrorToken(parsed.data.token)) throw error(410, 'session expired');

	const { id, title, startTs, endTs, allDay, location, profileIds, calendarId } = parsed.data;
	const payload = { title, startTs, endTs, allDay, location, profileIds, calendarId };
	if (id !== undefined) {
		const ok = await updateLocalEvent(id, payload);
		if (!ok) throw error(404, 'event not found');
	} else {
		await appendLocalEvent(payload);
	}
	publishLive(); // tell the display to refresh
	return json({ ok: true });
};
