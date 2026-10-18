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
 *
 * Two things the client is never trusted for, because trusting it caused
 * real damage on-device:
 *
 * 1. devicePasswordSet. The client-side family store has no field for this
 *    at all — it is set only by /api/pi-password, /api/factory-reset and
 *    /api/recovery/verify, each of which loads-then-mutates the real config.
 *    This endpoint instead replaces the ENTIRE config with whatever the
 *    client sent, and the client never sends this field, so Zod quietly
 *    filled in its schema default (false) on every single Settings save —
 *    unconditionally turning the password gate back off the moment anyone
 *    changed anything in Settings, including just picking a time zone.
 *    Confirmed on-device: a device that had a real password set, and had
 *    just been used to install an update with no prompt, showed
 *    devicePasswordSet: false moments after a routine Settings save. Always
 *    carrying the server's own value forward closes that regardless of what
 *    the client does or doesn't know to send.
 *
 * 2. Dropping every profile in one save. Legitimately removing one of
 *    several people is a normal edit (ProfileEditor -> persist()); legitimately
 *    going from some profiles to zero, on an already-set-up device, is not a
 *    real user action anywhere in this app -- it is what a client posting a
 *    stale/not-yet-hydrated snapshot looks like. Refusing that specific shape
 *    turns a silent, unrecoverable data-loss bug into a loud, retryable 400.
 */
export const POST: RequestHandler = async ({ request }) => {
	const parsed = PersistedConfigSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, 'invalid config');

	const before = await loadConfig();

	if (before.setupComplete && before.profiles.length > 0 && parsed.data.profiles.length === 0) {
		logEvent('config.rejectedProfileWipe', { had: before.profiles.length });
		throw error(409, 'Refusing to save: this would remove every profile. Reload and try again.');
	}

	await saveConfig({ ...parsed.data, devicePasswordSet: before.devicePasswordSet });

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
