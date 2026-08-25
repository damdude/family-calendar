/**
 * Domain types for the UI layer.
 *
 * These are the *resolved* shapes the interface consumes (Dates instead of unix
 * seconds, relations joined). They mirror the SQLite schema in
 * src/lib/server/db/schema.sql (added in Batch 4) but are deliberately decoupled
 * from it — the persistence layer maps rows to these.
 *
 * Per ADR-002, nothing here hardcodes a family; all instances come from the DB
 * at runtime or from src/lib/fake during development.
 */

/** Keys into the pastel profile palette (see design/tokens.css). */
export type ProfileColor =
	'pink' | 'sage' | 'sky' | 'lavender' | 'peach' | 'coral' | 'mint' | 'orchid';

export type ProfileRole = 'parent' | 'child';

export interface Profile {
	id: number;
	name: string;
	nickname?: string;
	age: number;
	role: ProfileRole;
	color: ProfileColor;
	/** Emoji stand-in used when no uploaded photo is present. */
	avatarEmoji: string;
	/** Addresses that identify this person on a synced calendar invite, used
	 *  to auto-tag events by who's actually invited (not the organizer, not
	 *  a name match in the title). */
	emails?: string[];
	/**
	 * Set when the profile has an uploaded (encrypted) photo. Doubles as a
	 * cache-buster for the /media/avatar/<id> URL. Absent → show the emoji.
	 */
	photoUpdatedAt?: number;
	/** Today's task progress, shown on the profile pill (e.g. "Liam 2/3"). */
	tasks: { done: number; total: number };
	/** Whether this profile follows morning/evening routines. Undefined defers
	 *  to the role-based default (children on, adults off) — see `routinesOn()`. */
	routinesEnabled?: boolean;
}

/** `routinesEnabled` defaults by role when unset, rather than always true —
 *  seeding routines for a parent profile by default wouldn't make sense. */
export function routinesOn(p: Pick<Profile, 'role' | 'routinesEnabled'>): boolean {
	return p.routinesEnabled ?? p.role === 'child';
}

export interface FamilyEvent {
	id: number;
	title: string;
	start: Date;
	end: Date;
	allDay: boolean;
	location?: string;
	/** One or more profiles; multiple → a shared/split event card. */
	profileIds: number[];
}

/** Icon keys for routine steps — resolved to SVGs in lib/icons. */
export type RoutineIcon =
	| 'toothbrush'
	| 'bed'
	| 'backpack'
	| 'shoes'
	| 'plate'
	| 'book'
	| 'shirt'
	| 'bath'
	| 'water'
	| 'brush-hair'
	| 'lunchbox'
	| 'moon'
	| 'sun'
	| 'star';

export interface RoutineStep {
	id: number;
	icon: RoutineIcon;
	label: string;
	estimatedMinutes: number;
	order: number;
	/** Completion state for *today* (mockup-level; persisted in Batch 3). */
	done: boolean;
}

export type RoutineTimeOfDay = 'morning' | 'afternoon' | 'evening';

export interface Routine {
	id: number;
	profileId: number;
	name: string;
	timeOfDay: RoutineTimeOfDay;
	active: boolean;
	steps: RoutineStep[];
	streak: Streak;
}

export interface Streak {
	current: number;
	longest: number;
	lastCompletedDate?: string; // YYYY-MM-DD
}

export interface Reward {
	id: number;
	name: string;
	starCost: number;
	active: boolean;
	/** Emoji illustration for the reward ladder. */
	icon: string;
}

/** A reward a child redeemed with their stars. */
export interface RewardClaim {
	id: number;
	rewardId: number;
	profileId: number;
	/** Snapshot so history survives if the reward is later edited/removed. */
	rewardName: string;
	icon: string;
	starCost: number;
	/** Unix ms when claimed. */
	ts: number;
}

export interface Feeling {
	emoji: string;
	label: string;
}

/** A feeling a profile logged (Today's Feelings check-in). */
export interface FeelingLog {
	profileId: number;
	emoji: string;
	label: string;
	loggedAt: Date;
}

export type ListKind = 'grocery' | 'todo' | 'packing' | 'custom';

export interface ListItem {
	id: number;
	text: string;
	completed: boolean;
	completedBy?: number;
}

export interface CustomList {
	id: number;
	name: string;
	kind: ListKind;
	icon: string;
	items: ListItem[];
}

export interface Task {
	id: number;
	text: string;
	done: boolean;
	profileId?: number;
	dueDate?: string; // YYYY-MM-DD
}

export interface Recipe {
	id: number;
	name: string;
	emoji: string;
	ingredients: string[];
	steps: string[];
	/** Optional metadata when imported from the web / a catalog. */
	sourceUrl?: string;
	image?: string;
	cuisine?: string;
	category?: string;
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface Meal {
	id: number;
	date: string; // YYYY-MM-DD
	mealType: MealType;
	name: string;
	emoji: string;
	/** Set when the meal was planned from a recipe → tap the day to view it. */
	recipeId?: number;
}

export interface Weather {
	tempF: number;
	condition: string;
	/** Emoji glyph for the condition chip. */
	icon: string;
}

/** Per-profile star tally (rewards economy). */
export interface StarBalance {
	profileId: number;
	stars: number;
}

/** The full resolved family dataset the UI renders from. */
export interface FamilyData {
	familyName: string;
	timezone: string;
	weekStartsOn: 0 | 1; // 0 = Sunday, 1 = Monday
	profiles: Profile[];
	events: FamilyEvent[];
	routines: Routine[];
	rewards: Reward[];
	stars: StarBalance[];
	rewardClaims: RewardClaim[];
	feelingsToday: FeelingLog[];
	lists: CustomList[];
	meals: Meal[];
	tasks: Task[];
	recipes: Recipe[];
	weather: Weather;
}
