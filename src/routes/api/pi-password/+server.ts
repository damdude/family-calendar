import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { getSession } from '$lib/server/pairing';
import { loadConfig, saveConfig } from '$lib/server/config';
import { logEvent } from '$lib/server/debugLog';
import { CONTROL_CHARS, setDevicePassword } from '$lib/server/devicePassword';
import { verifyDevicePassword } from '$lib/server/deviceAuth';
import type { RequestHandler } from './$types';

const BodySchema = z.object({
	token: z.string(),
	newPassword: z
		.string()
		.min(6, 'Use at least 6 characters.')
		.max(128)
		.refine((v) => !CONTROL_CHARS.test(v), 'That password contains unsupported characters.'),
	confirmPassword: z.string()
});

/**
 * Set the appliance user's login/SSH password during setup.
 *
 * Gated on a live setup pairing token: only someone who scanned the QR on the
 * display can reach it, and it stops working once setup is finished. Without
 * that, anything on the LAN could change the device password unprompted.
 *
 * The password goes to the privileged helper over stdin — never interpolated
 * into a shell string, and never an argv element where `ps` could read it.
 */
export const POST: RequestHandler = async ({ request }) => {
	const parsed = BodySchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, parsed.error.issues[0]?.message ?? 'invalid request');

	const { token, newPassword, confirmPassword } = parsed.data;
	if (!getSession(token)) {
		logEvent('password.rejected', { reason: 'setup session expired' });
		throw error(403, 'This setup session has expired.');
	}
	if (newPassword !== confirmPassword) {
		logEvent('password.rejected', { reason: 'mismatch' });
		throw error(400, 'The passwords do not match.');
	}
	logEvent('password.attempt', { length: newPassword.length });

	const result = await setDevicePassword(newPassword);

	logEvent('password.result', { ok: result.ok, detail: result.message });

	// Prove the password that was stored is the one that was submitted, while
	// the person is still standing here. A browser password manager offering
	// to generate a "strong password" can fill both fields without the family
	// registering it, and the divergence would otherwise only surface days
	// later as "the update won't accept my password" — by which point the
	// device is locked out of updates, factory reset AND ssh, and the only
	// way back is reflashing the card.
	if (result.ok) {
		const roundTrip = await verifyDevicePassword(newPassword);
		logEvent('password.verified', { ok: roundTrip });
		if (!roundTrip) {
			throw error(
				500,
				'The password was changed but did not verify afterwards. Re-enter it, and if your browser offered to fill a generated password, decline it.'
			);
		}
	}
	if (!result.ok) {
		console.error('Password change failed:', result.message);
		throw error(500, 'Could not change the device password.');
	}

	// From here on the device has a password the family actually chose, so the
	// privileged actions can start demanding it.
	const config = await loadConfig();
	if (!config.devicePasswordSet) await saveConfig({ ...config, devicePasswordSet: true });

	return json({ ok: true });
};
