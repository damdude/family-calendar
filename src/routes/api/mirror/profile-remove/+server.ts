import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { isMirrorToken } from '$lib/server/mirror';
import { loadConfig, saveConfig } from '$lib/server/config';
import { publishLive } from '$lib/server/live';
import type { RequestHandler } from './$types';

const Body = z.object({ token: z.string(), id: z.number().int() });

/** Phone companion → server: remove a family member. */
export const POST: RequestHandler = async ({ request }) => {
	const parsed = Body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, 'invalid request');
	if (!isMirrorToken(parsed.data.token)) throw error(410, 'session expired');

	const config = await loadConfig();
	const i = config.profiles.findIndex((p) => p.id === parsed.data.id);
	if (i < 0) throw error(404, 'profile not found');
	config.profiles.splice(i, 1);

	await saveConfig(config);
	publishLive();
	return json({ ok: true, profiles: config.profiles });
};
