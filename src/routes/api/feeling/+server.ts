import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { logFeeling } from '$lib/server/progress';
import type { RequestHandler } from './$types';

const BodySchema = z.object({
	profileId: z.number().int(),
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	emoji: z.string().min(1).max(8),
	label: z.string().min(1).max(40)
});

/** Persist a Today's Feelings check-in for a profile. */
export const POST: RequestHandler = async ({ request }) => {
	const parsed = BodySchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, 'invalid payload');
	const { profileId, date, emoji, label } = parsed.data;
	await logFeeling(profileId, date, emoji, label);
	return json({ ok: true });
};
