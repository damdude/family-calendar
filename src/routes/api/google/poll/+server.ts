import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { GOOGLE_PROVIDER, pollDeviceToken } from '$lib/server/google';
import { saveOAuthToken } from '$lib/server/db/repo';
import { syncGoogle } from '$lib/server/sync';
import { stashPendingGoogle } from '$lib/server/pairing';
import { logEvent } from '$lib/server/debugLog';
import type { RequestHandler } from './$types';

const Body = z.object({
	deviceCode: z.string().min(1),
	profileId: z.number().int().optional(), // null/undefined = shared account
	/** Set while the setup wizard is running, where the profile being
	 *  connected has no real id yet — see stashPendingGoogle. */
	setupToken: z.string().optional(),
	draftProfileId: z.string().optional()
});

/** Poll once for the token. On success, store it (encrypted) per-profile and sync. */
export const POST: RequestHandler = async ({ request }) => {
	const parsed = Body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, 'missing deviceCode');

	const result = await pollDeviceToken(parsed.data.deviceCode);
	logEvent('google.poll', { status: result.status });
	if (result.status === 'granted') {
		const { setupToken, draftProfileId } = parsed.data;
		if (setupToken && draftProfileId) {
			// Mid-wizard: the profile is still a draft, so hold the token on the
			// pairing session and let /setup/complete write it once ids exist.
			// Syncing now would be pointless — there are no profiles yet.
			const held = stashPendingGoogle(setupToken, draftProfileId, {
				refreshToken: result.refreshToken,
				accessToken: result.accessToken,
				accessExpiresAt: Math.floor(Date.now() / 1000) + result.expiresIn
			});
			if (!held) throw error(410, 'This setup session has expired.');
			return json({ status: 'granted', pending: true });
		}
		saveOAuthToken({
			provider: GOOGLE_PROVIDER,
			profileId: parsed.data.profileId,
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
