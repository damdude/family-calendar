import { json, error } from '@sveltejs/kit';
import { scrapeRecipe } from '$lib/server/recipeScraper';
import type { RequestHandler } from './$types';

/** Scrape a recipe URL and return a recipe payload the client can save. */
export const POST: RequestHandler = async ({ request }) => {
	const { url } = await request.json().catch(() => ({}));
	if (!url || typeof url !== 'string') error(400, 'url required');
	const recipe = await scrapeRecipe(url);
	if (!recipe) error(422, "Couldn't read a recipe from that page");
	return json(recipe);
};
