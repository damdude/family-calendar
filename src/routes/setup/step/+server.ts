import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { getSession, updateDraft } from '$lib/server/pairing';
import { SetupDraftSchema } from '$lib/server/schema';
import { publish } from '$lib/server/bus';
import type { RequestHandler } from './$types';

const BodySchema = z.object({ token: z.string(), draft: SetupDraftSchema });

/**
 * Phone → server: a draft snapshot for the current step. Validated, stored on
 * the pairing session, then broadcast to the kiosk for live preview.
 */
export const POST: RequestHandler = async ({ request }) => {
	const parsed = BodySchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, 'invalid setup payload');

	const { token, draft } = parsed.data;
	if (!getSession(token)) throw error(410, 'This setup session has expired.');

	updateDraft(token, draft);
	publish(token, { type: 'draft', draft });
	return json({ ok: true });
};
