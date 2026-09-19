import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { getAllChores, upsertChore } from '$lib/server/familydata';
import type { RequestHandler } from './$types';

const CreateChoreBody = z.object({
	name: z.string().min(1).max(120),
	icon: z.string().max(8).default('🎯'),
	starReward: z.number().int().min(1).max(100),
	frequency: z.enum(['once', 'daily', 'weekly']).default('daily'),
	dueTime: z.string().optional(),
	dueDate: z.string().optional()
});

export const GET: RequestHandler = async () => {
	const chores = await getAllChores();
	return json(chores);
};

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const parsed = CreateChoreBody.safeParse(body);
		if (!parsed.success) throw new Error(parsed.error.message);

		const chore = await upsertChore({
			id: 0, // Will be assigned
			...parsed.data,
			completed: false
		});
		return json(chore, { status: 201 });
	} catch (e) {
		throw error(400, e instanceof Error ? e.message : 'Invalid chore data');
	}
};
