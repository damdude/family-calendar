import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { getCalendars, removeCalendar } from '$lib/server/db/repo';
import { publishLive } from '$lib/server/live';
import type { RequestHandler } from './$types';

const Body = z.object({ id: z.number().int() });

export const POST: RequestHandler = async ({ request }) => {
	const parsed = Body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, 'invalid request');
	removeCalendar(parsed.data.id);
	publishLive(); // tell the display to refresh
	return json({ ok: true, calendars: getCalendars('ical') });
};
