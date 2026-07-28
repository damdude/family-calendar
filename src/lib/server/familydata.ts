/**
 * Persistence for user-editable family content that isn't sensitive enough for
 * SQLite: meal plan + custom lists. Stored as data/family-data.json (atomic).
 * Empty file → null, so the store keeps its demo data until the family edits.
 */

import fsp from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { DATA_DIR } from './paths';

const MealSchema = z.object({
	id: z.number().int(),
	date: z.string(),
	mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
	name: z.string().max(120),
	emoji: z.string().max(8)
});

const ListItemSchema = z.object({
	id: z.number().int(),
	text: z.string().max(200),
	completed: z.boolean(),
	completedBy: z.number().int().optional()
});

const ListSchema = z.object({
	id: z.number().int(),
	name: z.string().max(60),
	kind: z.enum(['grocery', 'todo', 'packing', 'custom']),
	icon: z.string().max(8),
	items: z.array(ListItemSchema).max(500)
});

export const FamilyDataSchema = z.object({
	meals: z.array(MealSchema).max(200),
	lists: z.array(ListSchema).max(50)
});

export type FamilyDataPersist = z.infer<typeof FamilyDataSchema>;

const FILE = path.join(DATA_DIR, 'family-data.json');

export async function loadFamilyData(): Promise<FamilyDataPersist | null> {
	try {
		return FamilyDataSchema.parse(JSON.parse(await fsp.readFile(FILE, 'utf8')));
	} catch {
		return null;
	}
}

export async function saveFamilyData(data: FamilyDataPersist): Promise<void> {
	const validated = FamilyDataSchema.parse(data);
	await fsp.mkdir(DATA_DIR, { recursive: true });
	const tmp = `${FILE}.tmp`;
	await fsp.writeFile(tmp, JSON.stringify(validated, null, 2), 'utf8');
	await fsp.rename(tmp, FILE);
}
