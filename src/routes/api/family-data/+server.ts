import { error, json } from '@sveltejs/kit';
import { FamilyDataSchema, saveFamilyData } from '$lib/server/familydata';
import type { RequestHandler } from './$types';

/** Persist the meals + lists snapshot from the store (debounced client-side). */
export const POST: RequestHandler = async ({ request }) => {
	const parsed = FamilyDataSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, 'invalid family data');
	await saveFamilyData(parsed.data);
	return json({ ok: true });
};
