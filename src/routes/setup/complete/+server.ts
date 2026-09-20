import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { getSession, markComplete } from '$lib/server/pairing';
import { saveOAuthToken } from '$lib/server/db/repo';
import { GOOGLE_PROVIDER } from '$lib/server/google';
import { syncGoogle } from '$lib/server/sync';
import { SetupDraftSchema, type PersistedProfile } from '$lib/server/schema';
import { loadConfig, saveConfig } from '$lib/server/config';
import { publish } from '$lib/server/bus';
import type { RequestHandler } from './$types';

const BodySchema = z.object({ token: z.string(), draft: SetupDraftSchema });

/**
 * Phone → server: finish setup. Persists the family + profiles into
 * config.json (non-sensitive) and tells the kiosk to advance to the dashboard.
 * Secrets (OAuth, photos) are handled by the encrypted store in Batch 4.
 */
export const POST: RequestHandler = async ({ request }) => {
	const parsed = BodySchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, 'invalid setup payload');

	const { token, draft } = parsed.data;
	const session = getSession(token);
	if (!session) throw error(410, 'This setup session has expired.');
	if (draft.profiles.length === 0) throw error(400, 'add at least one profile');

	const current = await loadConfig();
	const profiles: PersistedProfile[] = draft.profiles.map((p, i) => ({
		id: i + 1,
		name: p.name,
		age: p.age,
		role: p.age >= 18 ? 'parent' : 'child',
		color: p.color,
		avatarEmoji: p.avatarEmoji,
		emails: []
	}));

	await saveConfig({
		...current,
		setupComplete: true,
		family: { ...draft.family, sharedEmails: [] },
		profiles,
		app: { ...current.app, view: { ...current.app.view, weekStartsOn: draft.family.weekStartsOn } }
	});

	// Google accounts connected during the wizard were held against draft ids
	// because the real ones did not exist yet. They do now.
	let connected = 0;
	draft.profiles.forEach((p, i) => {
		const pending = session.pendingGoogle.get(p.id);
		if (!pending) return;
		saveOAuthToken({
			provider: GOOGLE_PROVIDER,
			profileId: i + 1,
			refreshToken: pending.refreshToken,
			accessToken: pending.accessToken,
			accessExpiresAt: pending.accessExpiresAt
		});
		connected++;
	});
	session.pendingGoogle.clear();
	if (connected > 0) {
		// Best effort: the dashboard should not be held up by a first sync, and
		// Settings can retry it.
		syncGoogle().catch(() => {});
	}

	markComplete(token);
	publish(token, { type: 'complete' });

	// Clear the setup token cookie since setup is done
	return new Response(JSON.stringify({ ok: true }), {
		status: 200,
		headers: {
			'content-type': 'application/json',
			'set-cookie': '_setup_token=; Path=/setup; Max-Age=0'
		}
	});
};
