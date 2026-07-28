import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { isPinSet, setPin, verifyPin } from '$lib/server/pin';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	return json({ pinSet: await isPinSet() });
};

const Body = z.object({
	pin: z.string().regex(/^\d{4,8}$/, 'PIN must be 4–8 digits'),
	current: z.string().optional()
});

/** Set or change the admin PIN. If one already exists, `current` must match. */
export const POST: RequestHandler = async ({ request }) => {
	const parsed = Body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, parsed.error.issues[0]?.message ?? 'invalid PIN');

	if (await isPinSet()) {
		if (!parsed.data.current || !(await verifyPin(parsed.data.current))) {
			throw error(403, 'current PIN is incorrect');
		}
	}
	await setPin(parsed.data.pin);
	return json({ ok: true });
};
