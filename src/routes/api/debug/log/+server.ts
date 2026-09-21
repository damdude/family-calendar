import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { debugEnabled, logEvent } from '$lib/server/debugLog';
import type { RequestHandler } from './$types';

/**
 * Lets the browser record what the server cannot see: which wizard step
 * someone is on, which tab they opened, which setting they just changed.
 * Those transitions never reach the server on their own, and they are exactly
 * the context that makes a later failure interpretable.
 *
 * Bounded on purpose — this is writable by anything on the LAN, so it must
 * not become a way to fill the SD card. The event name and payload are capped,
 * and nothing is written at all when debug mode is off.
 */
const Body = z.object({
	event: z.string().min(1).max(64),
	details: z.record(z.string(), z.unknown()).optional()
});

export const POST: RequestHandler = async ({ request }) => {
	if (!debugEnabled()) return json({ ok: true, logged: false });

	const parsed = Body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return json({ ok: false }, { status: 400 });

	const details = parsed.data.details ?? {};
	// Redaction happens in logEvent; this only stops someone shipping a
	// megabyte of "details" per call.
	const trimmed = Object.fromEntries(Object.entries(details).slice(0, 20));
	logEvent(`ui.${parsed.data.event}`, trimmed);
	return json({ ok: true, logged: true });
};
