import { error, json } from '@sveltejs/kit';
import { loadConfig, saveConfig } from '$lib/server/config';
import { PersistedConfigSchema } from '$lib/server/schema';
import type { RequestHandler } from './$types';

/** Current persisted config. */
export const GET: RequestHandler = async () => {
	return json(await loadConfig());
};

/** Persist a full config (validated). Settings sends the store snapshot. */
export const POST: RequestHandler = async ({ request }) => {
	const parsed = PersistedConfigSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, 'invalid config');
	await saveConfig(parsed.data);
	return json({ ok: true });
};
