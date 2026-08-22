import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { isMirrorToken } from '$lib/server/mirror';
import { appendRecipe } from '$lib/server/familydata';
import { publishLive } from '$lib/server/live';
import type { RequestHandler } from './$types';

const Body = z.object({
	token: z.string(),
	name: z.string().trim().min(1).max(120),
	emoji: z.string().max(8).default('🍽️'),
	ingredients: z.array(z.string().max(300)).max(100),
	steps: z.array(z.string().max(1000)).max(100)
});

/** Phone companion → server: add a recipe. */
export const POST: RequestHandler = async ({ request }) => {
	const parsed = Body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, 'invalid recipe');
	if (!isMirrorToken(parsed.data.token)) throw error(410, 'session expired');

	const { name, emoji, ingredients, steps } = parsed.data;
	const recipe = await appendRecipe({ name, emoji, ingredients, steps });
	publishLive();
	return json({ ok: true, recipe });
};
