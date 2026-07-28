import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { GOOGLE_PROVIDER, pollDeviceToken } from '$lib/server/google';
import { saveOAuthToken } from '$lib/server/db/repo';
import { syncGoogle } from '$lib/server/sync';
import type { RequestHandler } from './$types';

const Body = z.object({ deviceCode: z.string().min(1) });

/** Poll once for the token. On success, store it (encrypted) and sync. */
export const POST: RequestHandler = async ({ request }) => {
	const parsed = Body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, 'missing deviceCode');

	const result = await pollDeviceToken(parsed.data.deviceCode);
	if (result.status === 'granted') {
		saveOAuthToken({
			provider: GOOGLE_PROVIDER,
			refreshToken: result.refreshToken,
			accessToken: result.accessToken,
			accessExpiresAt: Math.floor(Date.now() / 1000) + result.expiresIn
		});
		let synced = 0;
		try {
			synced = await syncGoogle();
		} catch {
			/* first sync can be retried from Settings */
		}
		return json({ status: 'granted', synced });
	}
	return json(result);
};
