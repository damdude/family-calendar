import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { recordRoutineState } from '$lib/server/progress';
import { awardStars } from '$lib/server/familydata';
import { publishLive } from '$lib/server/live';
import type { RequestHandler } from './$types';

const BodySchema = z.object({
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	doneStepIds: z.array(z.number().int()).max(64),
	total: z.number().int().min(0).max(64),
	// Optional so older cached clients (pre this field) don't 400 — just
	// skips the star award, same as before this endpoint could do one.
	profileId: z.number().int().optional()
});

/** Persist a routine's completed-steps set for a day; returns the updated
 *  streak, plus the profile's new star total when this call is what pushed
 *  the routine to fully complete for today (one star per routine per day). */
export const POST: RequestHandler = async ({ request, params }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id)) throw error(400, 'bad routine id');
	const parsed = BodySchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, 'invalid payload');
	const { date, doneStepIds, total, profileId } = parsed.data;
	const progress = await recordRoutineState(id, date, doneStepIds, total);

	let stars: number | undefined;
	if (progress.justCompleted && profileId !== undefined) {
		stars = await awardStars(profileId, 1);
		publishLive(); // e.g. the phone's Rewards tab should see the new balance
	}
	return json({ ...progress, stars });
};
