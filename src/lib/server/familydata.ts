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

const LocalEventSchema = z.object({
	id: z.number().int(),
	title: z.string().max(120),
	startTs: z.number().int(), // unix seconds
	endTs: z.number().int(),
	allDay: z.boolean(),
	location: z.string().max(120).optional(),
	profileIds: z.array(z.number().int()).max(12)
});

const TaskSchema = z.object({
	id: z.number().int(),
	text: z.string().max(200),
	done: z.boolean(),
	profileId: z.number().int().optional(),
	dueDate: z.string().optional() // YYYY-MM-DD
});

const RecipeSchema = z.object({
	id: z.number().int(),
	name: z.string().max(120),
	emoji: z.string().max(8).default('🍽️'),
	ingredients: z.array(z.string().max(200)).max(100),
	steps: z.array(z.string().max(500)).max(100)
});

export const FamilyDataSchema = z.object({
	meals: z.array(MealSchema).max(200),
	lists: z.array(ListSchema).max(50),
	localEvents: z.array(LocalEventSchema).max(500).default([]),
	tasks: z.array(TaskSchema).max(500).default([]),
	recipes: z.array(RecipeSchema).max(200).default([])
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

export type LocalEventInput = z.infer<typeof LocalEventSchema>;
export type TaskInput = z.infer<typeof TaskSchema>;

function emptyData(): FamilyDataPersist {
	return { meals: [], lists: [], localEvents: [], tasks: [], recipes: [] };
}

/** Append a local event server-side (used by phone quick-add). Assigns an id. */
export async function appendLocalEvent(e: Omit<LocalEventInput, 'id'>): Promise<LocalEventInput> {
	const data = (await loadFamilyData()) ?? emptyData();
	const id = data.localEvents.reduce((m, x) => Math.max(m, x.id), 0) + 1;
	const event = LocalEventSchema.parse({ ...e, id });
	data.localEvents.push(event);
	await saveFamilyData(data);
	return event;
}

/** Append a task server-side (phone quick-add). */
export async function appendTask(t: Omit<TaskInput, 'id' | 'done'>): Promise<TaskInput> {
	const data = (await loadFamilyData()) ?? emptyData();
	const id = data.tasks.reduce((m, x) => Math.max(m, x.id), 0) + 1;
	const task = TaskSchema.parse({ ...t, id, done: false });
	data.tasks.push(task);
	await saveFamilyData(data);
	return task;
}

/** Append an item to a list by id (phone quick-add). Returns false if no list. */
export async function appendListItem(listId: number, text: string): Promise<boolean> {
	const data = (await loadFamilyData()) ?? emptyData();
	const list = data.lists.find((l) => l.id === listId);
	if (!list) return false;
	const id = list.items.reduce((m, x) => Math.max(m, x.id), 0) + 1;
	list.items.push({ id, text, completed: false });
	await saveFamilyData(data);
	return true;
}
