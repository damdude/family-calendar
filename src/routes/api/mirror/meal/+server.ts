import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { isMirrorToken } from '$lib/server/mirror';
import { setMeal } from '$lib/server/familydata';
import { publishLive } from '$lib/server/live';
import type { RequestHandler } from './$types';

const Body = z.object({
	token: z.string(),
	date: z.string(), // YYYY-MM-DD
	mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
	name: z.string().max(120), // blank clears the meal
	emoji: z.string().max(8).default('🍽️')
});

/** Phone companion → server: set (or clear) a planned meal. */
export const POST: RequestHandler = async ({ request }) => {
	const parsed = Body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, 'invalid meal');
	if (!isMirrorToken(parsed.data.token)) throw error(410, 'session expired');

	const { date, mealType, name, emoji } = parsed.data;
	await setMeal(date, mealType, name, emoji);
	publishLive();
	return json({ ok: true });
};
