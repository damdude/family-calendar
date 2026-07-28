import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { getSession, markComplete } from '$lib/server/pairing';
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
	if (!getSession(token)) throw error(410, 'This setup session has expired.');
	if (draft.profiles.length === 0) throw error(400, 'add at least one profile');

	const current = await loadConfig();
	const profiles: PersistedProfile[] = draft.profiles.map((p, i) => ({
		id: i + 1,
		name: p.name,
		age: p.age,
		role: p.age >= 18 ? 'parent' : 'child',
		color: p.color,
		avatarEmoji: p.avatarEmoji
	}));

	await saveConfig({
		...current,
		setupComplete: true,
		family: draft.family,
		profiles,
		app: { ...current.app, view: { ...current.app.view, weekStartsOn: draft.family.weekStartsOn } }
	});

	markComplete(token);
	publish(token, { type: 'complete' });
	return json({ ok: true });
};
