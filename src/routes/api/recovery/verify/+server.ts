import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { verifyRecovery } from '$lib/server/recovery';
import { DEFAULT_DEVICE_PASSWORD, setDevicePassword } from '$lib/server/devicePassword';
import { loadConfig, saveConfig } from '$lib/server/config';
import { logEvent } from '$lib/server/debugLog';
import type { RequestHandler } from './$types';

const Body = z.object({ code: z.string().min(1).max(12) });

/**
 * Trade a code read off the screen for a password reset.
 *
 * Resets to the shipped default rather than letting the caller choose a new
 * one: the code proves presence, not identity, and a five-minute window is
 * the wrong place to be accepting a value that becomes the device's
 * long-lived credential. The family sets a real one from Settings straight
 * after, which is already gated on this password.
 */
export const POST: RequestHandler = async ({ request }) => {
	const parsed = Body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, 'invalid request');

	const result = verifyRecovery(parsed.data.code);
	logEvent('recovery.verify', { result });
	if (result !== 'ok') {
		const message =
			result === 'locked'
				? 'Too many attempts. Start recovery again from the screen.'
				: result === 'expired'
					? 'That code has expired. Start again.'
					: 'That code is not right.';
		return json({ ok: false, result, message }, { status: 401 });
	}

	const reset = await setDevicePassword(DEFAULT_DEVICE_PASSWORD);
	logEvent('recovery.passwordReset', { ok: reset.ok, detail: reset.message });
	if (!reset.ok) throw error(500, 'Could not reset the device password.');

	const cfg = await loadConfig();
	await saveConfig({ ...cfg, devicePasswordSet: false });

	return json({ ok: true, message: 'Device password reset. Set a new one in Settings.' });
};
