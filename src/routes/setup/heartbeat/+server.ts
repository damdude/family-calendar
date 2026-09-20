import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { getSession } from '$lib/server/pairing';
import type { RequestHandler } from './$types';

const Body = z.object({ token: z.string() });

/**
 * Keeps a setup session alive while the wizard is open.
 *
 * Deliberately separate from /setup/step: that one validates a full draft
 * before it touches the session, so it cannot refresh anything for someone
 * sitting on an early step with nothing filled in yet — which is exactly when
 * a family is most likely to pause.
 */
export const POST: RequestHandler = async ({ request }) => {
	const parsed = Body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, 'invalid request');
	if (!getSession(parsed.data.token)) throw error(410, 'This setup session has expired.');
	return json({ ok: true });
};
