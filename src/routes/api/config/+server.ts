import { error, json } from '@sveltejs/kit';
import { loadConfig, saveConfig } from '$lib/server/config';
import { PersistedConfigSchema } from '$lib/server/schema';
import { applySystemTimezone } from '$lib/server/systemTime';
import { logEvent } from '$lib/server/debugLog';
import type { RequestHandler } from './$types';

/** Current persisted config. */
export const GET: RequestHandler = async () => {
	return json(await loadConfig());
};

/**
 * Persist a full config (validated). Settings sends the store snapshot on
 * every change (debounced), so this is called far more often than the time
 * zone actually changes — the OS is only touched when it did, both to avoid
 * spawning a needless subprocess on every autosave and so a save that races
 * with another tab can't repeatedly stomp the clock.
 */
export const POST: RequestHandler = async ({ request }) => {
	const parsed = PersistedConfigSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, 'invalid config');

	const before = await loadConfig();
	await saveConfig(parsed.data);

	const nextTz = parsed.data.family.timezone;
	if (nextTz && nextTz !== before.family.timezone) {
		// Fire-and-forget: the config save already succeeded, and a family
		// should not have to wait on a subprocess to see their setting take.
		// The debug log is where a failure here actually surfaces.
		applySystemTimezone(nextTz)
			.then((r) => logEvent('timezone.applied', { zone: nextTz, ok: r.ok, detail: r.message }))
			.catch(() => {});
	}

	return json({ ok: true });
};
