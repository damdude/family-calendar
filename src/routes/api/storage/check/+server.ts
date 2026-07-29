import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { checkPath } from '$lib/server/storage';
import type { RequestHandler } from './$types';

const Body = z.object({ path: z.string().min(1) });

export const POST: RequestHandler = async ({ request }) => {
	const parsed = Body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, 'a path is required');
	return json(await checkPath(parsed.data.path));
};
