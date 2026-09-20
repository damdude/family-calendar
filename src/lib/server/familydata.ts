/**
 * Persistence for user-editable family content that isn't sensitive enough for
 * SQLite: meal plan + custom lists. Stored as data/family-data.json (atomic).
 * Empty file → null, so the store keeps its demo data until the family edits.
 */

import fsp from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { DATA_DIR } from './paths';
import { atomicWriteFile } from './atomicWrite';
import { loadConfig } from './config';

const MealSchema = z.object({
	id: z.number().int(),
	date: z.string(),
	mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
	name: z.string().max(120),
	emoji: z.string().max(8),
	recipeId: z.number().int().optional()
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
	profileIds: z.array(z.number().int()).max(12),
	// Which local calendar this is filed under — id 1 (the default "Family"
	// shared calendar) unless the family created more. Independent of
	// profileIds: calendarId is "where it's filed", profileIds is "who it's
	// for" — a shared calendar can still hold an event tagged to one person.
	calendarId: z.number().int().default(1)
});

const LocalCalendarSchema = z.object({
	id: z.number().int(),
	name: z.string().max(60),
	// undefined = shared/household calendar; set = "belongs to" one profile
	// (used to default quick-add placement, not to restrict who can see it).
	profileId: z.number().int().optional()
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
	ingredients: z.array(z.string().max(300)).max(100),
	steps: z.array(z.string().max(1000)).max(100),
	sourceUrl: z.string().max(500).optional(),
	image: z.string().max(1000).optional(),
	cuisine: z.string().max(40).optional(),
	category: z.string().max(40).optional()
});

const StarBalanceSchema = z.object({
	profileId: z.number().int(),
	stars: z.number().int().min(0)
});

const RewardClaimSchema = z.object({
	id: z.number().int(),
	rewardId: z.number().int(),
	profileId: z.number().int(),
	rewardName: z.string().max(120),
	icon: z.string().max(8),
	starCost: z.number().int().min(0),
	ts: z.number().int()
});

const ChoreSchema = z.object({
	id: z.number().int(),
	name: z.string().max(120),
	icon: z.string().max(8).default('🎯'),
	starReward: z.number().int().min(1).max(100),
	frequency: z.enum(['once', 'daily', 'weekly']).default('daily'),
	dueTime: z.string().optional(), // HH:MM format (e.g. "7:00 PM")
	dueDate: z.string().optional(), // YYYY-MM-DD for weekly chores
	assignedTo: z.number().int().optional(), // Profile ID who claimed it
	claimedAt: z.number().int().optional(), // unix seconds
	completed: z.boolean().default(false),
	completedAt: z.number().int().optional(),
	completedBy: z.number().int().optional() // Profile ID who completed it
});

const RewardSchema = z.object({
	id: z.number().int(),
	name: z.string().max(120),
	starCost: z.number().int().min(1).max(1000),
	active: z.boolean().default(true),
	icon: z.string().max(8).default('🎁')
});

export const FamilyDataSchema = z.object({
	meals: z.array(MealSchema).max(200),
	lists: z.array(ListSchema).max(50),
	localEvents: z.array(LocalEventSchema).max(500).default([]),
	localCalendars: z.array(LocalCalendarSchema).max(20).default([]),
	tasks: z.array(TaskSchema).max(500).default([]),
	recipes: z.array(RecipeSchema).max(200).default([]),
	stars: z.array(StarBalanceSchema).max(50).default([]),
	rewardClaims: z.array(RewardClaimSchema).max(1000).default([]),
	rewards: z.array(RewardSchema).max(50).default([]),
	chores: z.array(ChoreSchema).max(100).default([])
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
	await atomicWriteFile(FILE, JSON.stringify(validated, null, 2), 'utf8');
}

export type LocalEventInput = z.infer<typeof LocalEventSchema>;
export type TaskInput = z.infer<typeof TaskSchema>;
export type MealInput = z.infer<typeof MealSchema>;
export type RecipeInput = z.infer<typeof RecipeSchema>;
export type ListInput = z.infer<typeof ListSchema>;
export type RewardInput = z.infer<typeof RewardSchema>;
export type ChoreInput = z.infer<typeof ChoreSchema>;

export function emptyData(): FamilyDataPersist {
	return {
		meals: [],
		lists: [],
		localEvents: [],
		localCalendars: [],
		tasks: [],
		recipes: [],
		stars: [],
		rewardClaims: [],
		rewards: [],
		chores: []
	};
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

/** Replace an existing local event's fields (phone companion edit). Returns
 *  false if no such event. */
export async function updateLocalEvent(
	id: number,
	e: Omit<LocalEventInput, 'id'>
): Promise<boolean> {
	const data = (await loadFamilyData()) ?? emptyData();
	const i = data.localEvents.findIndex((x) => x.id === id);
	if (i < 0) return false;
	data.localEvents[i] = LocalEventSchema.parse({ ...e, id });
	await saveFamilyData(data);
	return true;
}

/** Remove a local event by id (phone companion). Returns false if no such
 *  event. */
export async function removeLocalEvent(id: number): Promise<boolean> {
	const data = (await loadFamilyData()) ?? emptyData();
	const i = data.localEvents.findIndex((x) => x.id === id);
	if (i < 0) return false;
	data.localEvents.splice(i, 1);
	await saveFamilyData(data);
	return true;
}

/** Create a new list (phone companion). Assigns an id. */
export async function addList(
	name: string,
	kind: ListInput['kind'],
	icon: string
): Promise<ListInput> {
	const data = (await loadFamilyData()) ?? emptyData();
	const id = data.lists.reduce((m, x) => Math.max(m, x.id), 0) + 1;
	const list = ListSchema.parse({ id, name, kind, icon, items: [] });
	data.lists.push(list);
	await saveFamilyData(data);
	return list;
}

/** Remove a task by id (phone companion). Returns false if no such task. */
export async function removeTask(id: number): Promise<boolean> {
	const data = (await loadFamilyData()) ?? emptyData();
	const i = data.tasks.findIndex((t) => t.id === id);
	if (i < 0) return false;
	data.tasks.splice(i, 1);
	await saveFamilyData(data);
	return true;
}

/** Add stars to a profile's balance (e.g. a completed routine). Creates the
 *  balance row if this is their first. Returns the new total. */
export async function awardStars(profileId: number, amount: number): Promise<number> {
	const data = (await loadFamilyData()) ?? emptyData();
	let balance = data.stars.find((s) => s.profileId === profileId);
	if (!balance) {
		balance = { profileId, stars: 0 };
		data.stars.push(balance);
	}
	balance.stars += amount;
	await saveFamilyData(data);
	return balance.stars;
}

/** Create or edit a reward on the ladder (phone companion / desktop). */
export async function saveReward(
	r: Omit<RewardInput, 'id'> & { id?: number }
): Promise<RewardInput> {
	const data = (await loadFamilyData()) ?? emptyData();
	if (r.id !== undefined) {
		const i = data.rewards.findIndex((x) => x.id === r.id);
		if (i < 0) throw new Error('reward not found');
		data.rewards[i] = RewardSchema.parse({ ...r, id: r.id });
		await saveFamilyData(data);
		return data.rewards[i];
	}
	const id = data.rewards.reduce((m, x) => Math.max(m, x.id), 0) + 1;
	const reward = RewardSchema.parse({ ...r, id });
	data.rewards.push(reward);
	await saveFamilyData(data);
	return reward;
}

/** Remove a reward from the ladder. Returns false if no such reward. */
export async function removeReward(id: number): Promise<boolean> {
	const data = (await loadFamilyData()) ?? emptyData();
	const i = data.rewards.findIndex((r) => r.id === id);
	if (i < 0) return false;
	data.rewards.splice(i, 1);
	await saveFamilyData(data);
	return true;
}

/** Redeem a reward: deduct stars and record the claim (phone companion —
 *  mirrors family.svelte.ts's claimReward for the desktop). Returns false if
 *  the reward doesn't exist or the balance can't cover it. */
export async function claimReward(rewardId: number, profileId: number): Promise<boolean> {
	const data = (await loadFamilyData()) ?? emptyData();
	const reward = data.rewards.find((r) => r.id === rewardId);
	if (!reward) return false;
	const balance = data.stars.find((s) => s.profileId === profileId);
	if (!balance || balance.stars < reward.starCost) return false;
	balance.stars -= reward.starCost;
	const id = data.rewardClaims.reduce((m, x) => Math.max(m, x.id), 0) + 1;
	data.rewardClaims.push({
		id,
		rewardId,
		profileId,
		rewardName: reward.name,
		icon: reward.icon,
		starCost: reward.starCost,
		ts: Date.now()
	});
	await saveFamilyData(data);
	return true;
}

/** Toggle a task's done state (phone companion). Returns false if no task. */
export async function toggleTaskDone(taskId: number): Promise<boolean> {
	const data = (await loadFamilyData()) ?? emptyData();
	const task = data.tasks.find((t) => t.id === taskId);
	if (!task) return false;
	task.done = !task.done;
	await saveFamilyData(data);
	return true;
}

/** Toggle a list item's completed state (phone companion). Returns false if
 *  no such list/item. */
export async function toggleListItemDone(listId: number, itemId: number): Promise<boolean> {
	const data = (await loadFamilyData()) ?? emptyData();
	const item = data.lists.find((l) => l.id === listId)?.items.find((i) => i.id === itemId);
	if (!item) return false;
	item.completed = !item.completed;
	await saveFamilyData(data);
	return true;
}

/** Set (or clear, if name is blank) the meal planned for a date + meal type
 *  (phone companion) — mirrors the client store's setMeal. */
export async function setMeal(
	date: string,
	mealType: MealInput['mealType'],
	name: string,
	emoji: string
): Promise<void> {
	const data = (await loadFamilyData()) ?? emptyData();
	const existing = data.meals.find((m) => m.date === date && m.mealType === mealType);
	if (!name.trim()) {
		if (existing) data.meals.splice(data.meals.indexOf(existing), 1);
	} else if (existing) {
		existing.name = name.trim();
		existing.emoji = emoji;
	} else {
		const id = data.meals.reduce((m, x) => Math.max(m, x.id), 0) + 1;
		data.meals.push(MealSchema.parse({ id, date, mealType, name: name.trim(), emoji }));
	}
	await saveFamilyData(data);
}

/** Append a recipe (phone companion). Assigns an id. */
export async function appendRecipe(r: Omit<RecipeInput, 'id'>): Promise<RecipeInput> {
	const data = (await loadFamilyData()) ?? emptyData();
	const id = data.recipes.reduce((m, x) => Math.max(m, x.id), 0) + 1;
	const recipe = RecipeSchema.parse({ ...r, id });
	data.recipes.push(recipe);
	await saveFamilyData(data);
	return recipe;
}

/** Remove a recipe by id (phone companion). Returns false if no such recipe. */
export async function removeRecipe(id: number): Promise<boolean> {
	const data = (await loadFamilyData()) ?? emptyData();
	const i = data.recipes.findIndex((r) => r.id === id);
	if (i < 0) return false;
	data.recipes.splice(i, 1);
	await saveFamilyData(data);
	return true;
}

// --- Chores ---

/** Create or update a chore. */
export async function upsertChore(c: ChoreInput): Promise<ChoreInput> {
	const data = (await loadFamilyData()) ?? emptyData();
	if (c.id && c.id > 0) {
		const i = data.chores.findIndex((x) => x.id === c.id);
		if (i >= 0) {
			data.chores[i] = ChoreSchema.parse({ ...c });
			await saveFamilyData(data);
			return data.chores[i];
		}
	}
	const id = data.chores.reduce((m, x) => Math.max(m, x.id), 0) + 1;
	const chore = ChoreSchema.parse({ ...c, id });
	data.chores.push(chore);
	await saveFamilyData(data);
	return chore;
}

/** Get all chores. */
export async function getAllChores(): Promise<ChoreInput[]> {
	const data = (await loadFamilyData()) ?? emptyData();
	return data.chores;
}

/** Get a chore by id. */
export async function getChoreById(id: number): Promise<ChoreInput | null> {
	const data = (await loadFamilyData()) ?? emptyData();
	return data.chores.find((c) => c.id === id) ?? null;
}

/** Claim a chore for a profile. */
export async function claimChore(choreId: number, profileId: number): Promise<ChoreInput | null> {
	const data = (await loadFamilyData()) ?? emptyData();
	const chore = data.chores.find((c) => c.id === choreId);
	if (!chore) return null;
	chore.assignedTo = profileId;
	chore.claimedAt = Math.floor(Date.now() / 1000);
	chore.completed = false;
	await saveFamilyData(data);
	return chore;
}

/** Unclaim a chore. */
export async function unclaimChore(choreId: number): Promise<ChoreInput | null> {
	const data = (await loadFamilyData()) ?? emptyData();
	const chore = data.chores.find((c) => c.id === choreId);
	if (!chore) return null;
	chore.assignedTo = undefined;
	chore.claimedAt = undefined;
	chore.completed = false;
	chore.completedAt = undefined;
	chore.completedBy = undefined;
	await saveFamilyData(data);
	return chore;
}

/** Mark a chore as complete. */
export async function completeChore(
	choreId: number,
	profileId: number
): Promise<ChoreInput | null> {
	const data = (await loadFamilyData()) ?? emptyData();
	const chore = data.chores.find((c) => c.id === choreId);
	if (!chore) return null;
	chore.completed = true;
	chore.completedAt = Math.floor(Date.now() / 1000);
	chore.completedBy = profileId;
	await saveFamilyData(data);
	return chore;
}

/** Delete a chore. */
export async function deleteChore(choreId: number): Promise<boolean> {
	const data = (await loadFamilyData()) ?? emptyData();
	const i = data.chores.findIndex((c) => c.id === choreId);
	if (i < 0) return false;
	data.chores.splice(i, 1);
	await saveFamilyData(data);
	return true;
}

// --- Chore History/Completion Tracking ---

export async function getChoreHistory(choreId: number, days: number = 30): Promise<ChoreInput[]> {
	const data = (await loadFamilyData()) ?? emptyData();
	const now = Math.floor(Date.now() / 1000);
	const cutoff = now - days * 86_400;
	return data.chores.filter((c) => c.id === choreId && c.completedAt && c.completedAt >= cutoff);
}

export interface ChoreStats {
	totalClaimed: number;
	totalCompleted: number;
	completionRate: number;
	totalStarsEarned: number;
}

/** Pure: stats for one profile from an already-loaded data set. */
export function choreStatsFor(chores: ChoreInput[], profileId: number): ChoreStats {
	let totalClaimed = 0;
	let totalCompleted = 0;
	let totalStarsEarned = 0;
	for (const c of chores) {
		if (c.assignedTo !== profileId) continue;
		totalClaimed++;
		if (c.completed) {
			totalCompleted++;
			totalStarsEarned += c.starReward;
		}
	}
	return {
		totalClaimed,
		totalCompleted,
		completionRate: totalClaimed > 0 ? (totalCompleted / totalClaimed) * 100 : 0,
		totalStarsEarned
	};
}

export async function getProfileChoreStats(profileId: number): Promise<ChoreStats> {
	const data = (await loadFamilyData()) ?? emptyData();
	return choreStatsFor(data.chores, profileId);
}

/**
 * Stats for every profile. Reads the data file ONCE — the previous version
 * awaited getProfileChoreStats() per profile, so a four-person family meant
 * four full reads and four JSON.parse passes over the same file for a single
 * request.
 */
export async function getAllChoreStats(): Promise<Record<number, ChoreStats>> {
	const [cfg, data] = await Promise.all([loadConfig(), loadFamilyData()]);
	const chores = (data ?? emptyData()).chores;
	const stats: Record<number, ChoreStats> = {};
	for (const profile of cfg.profiles) {
		stats[profile.id] = choreStatsFor(chores, profile.id);
	}
	return stats;
}

export async function resetCompletedChores(frequency: 'daily' | 'weekly'): Promise<void> {
	const data = (await loadFamilyData()) ?? emptyData();
	const now = new Date();
	const today = now.toISOString().split('T')[0];

	for (const chore of data.chores) {
		if (chore.frequency !== frequency) continue;

		// Reset if it matches the frequency (daily resets every day, weekly on Sunday)
		let shouldReset = false;
		if (frequency === 'daily') {
			shouldReset = Boolean(chore.completed && chore.dueDate && chore.dueDate !== today);
		} else if (frequency === 'weekly' && now.getDay() === 0) {
			// Sunday - reset weekly chores
			shouldReset = chore.completed;
		}

		if (shouldReset) {
			chore.completed = false;
			chore.completedAt = undefined;
			chore.completedBy = undefined;
			chore.assignedTo = undefined;
			chore.claimedAt = undefined;
		}

		// Update due dates for daily chores
		if (chore.frequency === 'daily') {
			chore.dueDate = today;
		} else if (chore.frequency === 'weekly' && !chore.dueDate) {
			const nextSunday = new Date(now);
			nextSunday.setDate(now.getDate() + ((7 - now.getDay()) % 7));
			chore.dueDate = nextSunday.toISOString().split('T')[0];
		}
	}

	await saveFamilyData(data);
}
