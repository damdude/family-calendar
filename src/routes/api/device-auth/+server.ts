import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import {
	devicePasswordAttemptAllowed,
	recordDevicePasswordAttempt,
	verifyDevicePassword
} from '$lib/server/deviceAuth';
import { createSessionToken, ELEVATED_COOKIE, ELEVATED_MAX_AGE_SECONDS } from '$lib/server/session';
import type { RequestHandler } from './$types';

const Body = z.object({ password: z.string().max(128) });

/**
 * Exchange the device login password for a short-lived elevated session, which
 * hooks.server.ts requires for the destructive actions (installing an update,
 * factory reset, moving the data directory, mounting a NAS share).
 *
 * The same endpoint serves the on-screen keyboard and the phone, because both
 * now render the one shared Settings page.
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
	const parsed = Body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, 'invalid request');

	if (!devicePasswordAttemptAllowed()) {
		throw error(429, 'Too many attempts — wait a minute and try again.');
	}

	const ok = await verifyDevicePassword(parsed.data.password);
	recordDevicePasswordAttempt(ok);
	if (!ok) return json({ ok: false }, { status: 401 });

	cookies.set(ELEVATED_COOKIE, createSessionToken('elevated'), {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: false,
		maxAge: ELEVATED_MAX_AGE_SECONDS
	});
	return json({ ok: true, expiresInSeconds: ELEVATED_MAX_AGE_SECONDS });
};
