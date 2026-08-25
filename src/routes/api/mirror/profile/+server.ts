import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { isMirrorToken } from '$lib/server/mirror';
import { loadConfig, saveConfig } from '$lib/server/config';
import { ProfileColorSchema } from '$lib/server/schema';
import { publishLive } from '$lib/server/live';
import type { RequestHandler } from './$types';

const Body = z.object({
	token: z.string(),
	id: z.number().int().optional(), // present = edit, absent = add
	name: z.string().trim().min(1).max(40),
	age: z.number().int().min(0).max(120),
	color: ProfileColorSchema,
	avatarEmoji: z.string().min(1).max(8),
	// Calendar invite addresses for this person, used to auto-tag synced
	// events by who's actually invited — see sync.ts's attendee matching.
	emails: z.array(z.string().trim().toLowerCase().max(254)).max(5).optional()
});

/** Phone companion → server: add or edit a family member. */
export const POST: RequestHandler = async ({ request }) => {
	const parsed = Body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, 'invalid profile');
	if (!isMirrorToken(parsed.data.token)) throw error(410, 'session expired');

	const { id, name, age, color, avatarEmoji, emails } = parsed.data;
	const config = await loadConfig();

	if (id !== undefined) {
		const existing = config.profiles.find((p) => p.id === id);
		if (!existing) throw error(404, 'profile not found');
		existing.name = name;
		existing.age = age;
		existing.color = color;
		existing.avatarEmoji = avatarEmoji;
		existing.role = age >= 18 ? 'parent' : 'child';
		if (emails) existing.emails = emails;
	} else {
		const newId = config.profiles.reduce((m, p) => Math.max(m, p.id), 0) + 1;
		config.profiles.push({
			id: newId,
			name,
			age,
			role: age >= 18 ? 'parent' : 'child',
			color,
			avatarEmoji,
			emails: emails ?? []
		});
	}

	await saveConfig(config);
	publishLive();
	return json({ ok: true, profiles: config.profiles });
};
