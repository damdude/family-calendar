import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { getCalendars, upsertCalendar } from '$lib/server/db/repo';
import { normalizeIcsUrl } from '$lib/server/ical';
import { syncIcal } from '$lib/server/sync';
import type { RequestHandler } from './$types';

/** List ICS/webcal subscriptions. */
export const GET: RequestHandler = () => {
	return json(getCalendars('ical'));
};

const Body = z.object({
	url: z.string().url(),
	name: z.string().max(60).default(''),
	colorHex: z.string().max(9).optional(),
	profileId: z.number().int().optional()
});

/** Subscribe to a calendar by iCal/webcal link, then sync it. */
export const POST: RequestHandler = async ({ request }) => {
	const parsed = Body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, 'a valid calendar link is required');

	const url = normalizeIcsUrl(parsed.data.url);
	upsertCalendar({
		provider: 'ical',
		externalId: url,
		name: parsed.data.name || new URL(url).hostname,
		colorHex: parsed.data.colorHex,
		profileId: parsed.data.profileId
	});

	let count = 0;
	try {
		count = await syncIcal();
	} catch {
		/* the feed may be slow/unreachable; cron will retry */
	}
	return json({ ok: true, count, calendars: getCalendars('ical') });
};
