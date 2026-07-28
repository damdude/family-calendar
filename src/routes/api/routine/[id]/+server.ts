import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { recordRoutineState } from '$lib/server/progress';
import type { RequestHandler } from './$types';

const BodySchema = z.object({
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	doneStepIds: z.array(z.number().int()).max(64),
	total: z.number().int().min(0).max(64)
});

/** Persist a routine's completed-steps set for a day; returns updated streak. */
export const POST: RequestHandler = async ({ request, params }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id)) throw error(400, 'bad routine id');
	const parsed = BodySchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, 'invalid payload');
	const { date, doneStepIds, total } = parsed.data;
	const progress = await recordRoutineState(id, date, doneStepIds, total);
	return json(progress);
};
