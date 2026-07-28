import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { verifyPin } from '$lib/server/pin';
import type { RequestHandler } from './$types';

const Body = z.object({ pin: z.string().max(16) });

export const POST: RequestHandler = async ({ request }) => {
	const parsed = Body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, 'invalid request');
	return json({ ok: await verifyPin(parsed.data.pin) });
};
