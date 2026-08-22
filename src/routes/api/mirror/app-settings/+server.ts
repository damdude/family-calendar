import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { isMirrorToken } from '$lib/server/mirror';
import { loadConfig, saveConfig } from '$lib/server/config';
import { publishLive } from '$lib/server/live';
import type { RequestHandler } from './$types';

const Body = z.object({
	token: z.string(),
	sleepStart: z.string().optional(),
	sleepEnd: z.string().optional(),
	sleepEnabled: z.boolean().optional(),
	idleMinutes: z.number().int().min(0).max(120).optional(),
	clock24h: z.boolean().optional()
});

/** Phone companion → server: sleep window + screensaver + clock format. */
export const POST: RequestHandler = async ({ request }) => {
	const parsed = Body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, 'invalid settings');
	if (!isMirrorToken(parsed.data.token)) throw error(410, 'session expired');

	const { sleepStart, sleepEnd, sleepEnabled, idleMinutes, clock24h } = parsed.data;
	const config = await loadConfig();
	if (sleepStart !== undefined) config.app.sleep.start = sleepStart;
	if (sleepEnd !== undefined) config.app.sleep.end = sleepEnd;
	if (sleepEnabled !== undefined) config.app.sleep.enabled = sleepEnabled;
	if (idleMinutes !== undefined) config.app.screensaver.idleMinutes = idleMinutes;
	if (clock24h !== undefined) config.app.view.clock24h = clock24h;

	await saveConfig(config);
	publishLive();
	return json({ ok: true });
};
