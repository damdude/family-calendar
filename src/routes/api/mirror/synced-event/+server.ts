import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { isMirrorToken } from '$lib/server/mirror';
import { getEventCalendarExternalId, setEventOverride } from '$lib/server/db/repo';
import { publishLive } from '$lib/server/live';
import type { RequestHandler } from './$types';

const Body = z.object({
	token: z.string(),
	id: z.number().int(),
	startTs: z.number().int(),
	endTs: z.number().int(),
	allDay: z.boolean(),
	location: z.string().max(120).optional(),
	// Who it's assigned to — replaces the whole list (add/remove both go
	// through here), same "whole family" convention as local events: an
	// empty array isn't "nobody", it means no one profile has been pinned
	// and the sync step's own guess / the calendar's default still applies.
	profileIds: z.array(z.number().int()).max(12).default([])
});

/** Phone companion → server: edit a synced event's time/location/assignment.
 *  Doesn't touch the source calendar (there's no write-back for an ICS
 *  subscription — read src/lib/server/db/repo.ts's event_overrides comment
 *  for why) — this is a local override that this app itself keeps showing
 *  in place of whatever the source says, until edited again or reset. */
export const POST: RequestHandler = async ({ request }) => {
	const parsed = Body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, 'invalid request');
	if (!isMirrorToken(parsed.data.token)) throw error(410, 'session expired');

	const ref = getEventCalendarExternalId(parsed.data.id);
	if (!ref) throw error(404, 'event not found');

	setEventOverride(ref.calendarId, ref.externalId, {
		startTs: parsed.data.startTs,
		endTs: parsed.data.endTs,
		allDay: parsed.data.allDay,
		location: parsed.data.location,
		profileIds: parsed.data.profileIds
	});
	publishLive();
	return json({ ok: true });
};
