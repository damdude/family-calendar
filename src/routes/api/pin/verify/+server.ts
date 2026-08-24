import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { verifyPin } from '$lib/server/pin';
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from '$lib/server/session';
import { pinAttemptAllowed, recordPinAttempt } from '$lib/server/pinRateLimit';
import type { RequestHandler } from './$types';

const Body = z.object({ pin: z.string().max(16) });

export const POST: RequestHandler = async ({ request, cookies }) => {
	const parsed = Body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, 'invalid request');

	if (!pinAttemptAllowed()) throw error(429, 'Too many attempts — try again shortly');
	const ok = await verifyPin(parsed.data.pin);
	recordPinAttempt(ok);

	if (ok) {
		// A verified PIN also unlocks the device/network-control API routes
		// hooks.server.ts gates (Wi-Fi, NAS, OTA install) — same trust level
		// as unlocking Settings on screen, just carried as a cookie so those
		// calls don't need to re-prompt.
		cookies.set(SESSION_COOKIE, createSessionToken(), {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: false,
			maxAge: SESSION_MAX_AGE_SECONDS
		});
	}
	return json({ ok });
};
