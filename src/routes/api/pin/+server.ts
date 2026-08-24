import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { isPinSet, setPin, verifyPin } from '$lib/server/pin';
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from '$lib/server/session';
import { pinAttemptAllowed, recordPinAttempt } from '$lib/server/pinRateLimit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	return json({ pinSet: await isPinSet() });
};

const Body = z.object({
	pin: z.string().regex(/^\d{4,8}$/, 'PIN must be 4–8 digits'),
	current: z.string().optional()
});

/** Set or change the admin PIN. If one already exists, `current` must match. */
export const POST: RequestHandler = async ({ request, cookies }) => {
	const parsed = Body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, parsed.error.issues[0]?.message ?? 'invalid PIN');

	if (await isPinSet()) {
		if (!pinAttemptAllowed()) throw error(429, 'Too many attempts — try again shortly');
		const currentOk = !!parsed.data.current && (await verifyPin(parsed.data.current));
		recordPinAttempt(currentOk);
		if (!currentOk) throw error(403, 'current PIN is incorrect');
	}
	await setPin(parsed.data.pin);
	// Setting/changing the PIN proves the same thing verifying it does —
	// grant a session so the browser that just set it isn't immediately
	// locked out of the device/network-control routes hooks.server.ts gates.
	cookies.set(SESSION_COOKIE, createSessionToken(), {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: false,
		maxAge: SESSION_MAX_AGE_SECONDS
	});
	return json({ ok: true });
};
