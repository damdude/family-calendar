import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { isMirrorToken } from '$lib/server/mirror';
import { getEventCalendarExternalId, clearEventOverride } from '$lib/server/db/repo';
import { publishLive } from '$lib/server/live';
import type { RequestHandler } from './$types';

const Body = z.object({ token: z.string(), id: z.number().int() });

/** Phone companion → server: drop a synced event's local override, reverting
 *  to whatever the source calendar itself currently says. */
export const POST: RequestHandler = async ({ request }) => {
	const parsed = Body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, 'invalid request');
	if (!isMirrorToken(parsed.data.token)) throw error(410, 'session expired');

	const ref = getEventCalendarExternalId(parsed.data.id);
	if (!ref) throw error(404, 'event not found');

	clearEventOverride(ref.calendarId, ref.externalId);
	publishLive();
	return json({ ok: true });
};
