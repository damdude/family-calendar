import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { getCalendars, setCalendarBirthdays } from '$lib/server/db/repo';
import { publishLive } from '$lib/server/live';
import type { RequestHandler } from './$types';

const Body = z.object({ id: z.number().int(), isBirthdays: z.boolean() });

/** Mark (or unmark) an already-subscribed calendar as the birthdays feed. */
export const POST: RequestHandler = async ({ request }) => {
	const parsed = Body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, 'invalid request');
	setCalendarBirthdays(parsed.data.id, parsed.data.isBirthdays);
	publishLive();
	return json({ ok: true, calendars: getCalendars('ical') });
};
