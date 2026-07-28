import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { addSite, getSites } from '$lib/server/sites';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const pid = url.searchParams.get('profileId');
	return json(await getSites(pid ? Number(pid) : undefined));
};

const Body = z.object({
	profileId: z.number().int(),
	url: z.string().url(),
	name: z.string().max(60).default('')
});

export const POST: RequestHandler = async ({ request }) => {
	const parsed = Body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, 'invalid site');
	const entry = await addSite(parsed.data.profileId, parsed.data.url, parsed.data.name);
	return json(entry);
};
