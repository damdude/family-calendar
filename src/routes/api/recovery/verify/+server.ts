import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { verifyRecovery } from '$lib/server/recovery';
import { CONTROL_CHARS, setDevicePassword } from '$lib/server/devicePassword';
import { verifyDevicePassword } from '$lib/server/deviceAuth';
import { loadConfig, saveConfig } from '$lib/server/config';
import { createSessionToken, ELEVATED_COOKIE, ELEVATED_MAX_AGE_SECONDS } from '$lib/server/session';
import { logEvent } from '$lib/server/debugLog';
import type { RequestHandler } from './$types';

const Body = z.object({
	code: z.string().min(1).max(12),
	newPassword: z
		.string()
		.min(6, 'Use at least 6 characters.')
		.max(128)
		.refine((v) => !CONTROL_CHARS.test(v), 'That password contains unsupported characters.'),
	confirmPassword: z.string()
});

/**
 * Trade a code read off the screen for a new device password.
 *
 * The code proves someone is standing at the display, which for a home
 * appliance is the right authority to set its password. An earlier version
 * reset to the shipped default instead and made the family change it
 * afterwards — that was worse, not safer: it left a window in which the
 * device was protected by a publicly known password. Doing it in one step
 * removes that window.
 *
 * The password is validated BEFORE the code is consumed, so a typo doesn't
 * cost a trip back to the screen for a fresh code.
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
	const parsed = Body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return json(
			{ ok: false, message: parsed.error.issues[0]?.message ?? 'invalid request' },
			{ status: 400 }
		);
	}

	const { code, newPassword, confirmPassword } = parsed.data;
	if (newPassword !== confirmPassword) {
		return json({ ok: false, message: 'The passwords do not match.' }, { status: 400 });
	}

	const result = verifyRecovery(code);
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

	const set = await setDevicePassword(newPassword);
	logEvent('recovery.passwordSet', { ok: set.ok, detail: set.message });
	if (!set.ok) throw error(500, 'Could not set the new device password.');

	// Same round-trip check the setup wizard does: prove what was stored is
	// what was submitted, rather than discovering days later that it wasn't.
	const roundTrip = await verifyDevicePassword(newPassword);
	logEvent('recovery.verified', { ok: roundTrip });
	if (!roundTrip) {
		throw error(
			500,
			'The password was changed but did not verify afterwards. Start recovery again, and decline any offer from your browser to fill a generated password.'
		);
	}

	const cfg = await loadConfig();
	await saveConfig({ ...cfg, devicePasswordSet: true });

	// Whoever did this stood at the screen and chose the password a moment
	// ago, which is at least as strong as typing it at the prompt. Issuing the
	// elevated session lets the action they were originally attempting carry
	// straight on instead of immediately asking for the password they just set.
	cookies.set(ELEVATED_COOKIE, createSessionToken('elevated'), {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: false,
		maxAge: ELEVATED_MAX_AGE_SECONDS
	});

	return json({ ok: true, message: 'Device password updated.' });
};
