/**
 * Reactive family store (runes).
 *
 * Starts empty — a real device has no family until setup writes one — and the
 * SSE layer mutates `data` in place (mutate-don't-spread — the home-display
 * pattern) so the whole UI stays reactive without re-assigning the root
 * object. Per ADR-002, demo data (src/lib/fake) is never imported here or by
 * any production code path.
 *
 * This is the single source the UI reads from; components never import
 * src/lib/fake directly.
 */

import {
	defaultConfig,
	type AppConfig,
	type DisplayMode,
	type PersistedConfigShape
} from '$lib/config';
import { emptyProgress, type FeelingEntry, type ProgressData } from '$lib/kid/progress';
import { defaultRoutinesForAge } from '$lib/kid/routineLibrary';
import { dateKey } from '$lib/time';
import type {
	FamilyData,
	FamilyEvent,
	Profile,
	Recipe,
	Reward,
	RewardClaim,
	Routine
} from '$lib/types';

export interface LocalEvent {
	id: number;
	title: string;
	startTs: number;
	endTs: number;
	allDay: boolean;
	location?: string;
	profileIds: number[];
}

/** Nothing configured yet — a fresh device before/without a real family. */
function emptyFamilyData(): FamilyData {
	return {
		familyName: '',
		timezone: 'UTC',
		weekStartsOn: 1,
		profiles: [],
		events: [],
		routines: [],
		rewards: [],
		stars: [],
		rewardClaims: [],
		feelingsToday: [],
		lists: [],
		meals: [],
		tasks: [],
		recipes: [],
		// No live weather source is wired up yet — this is a placeholder, not a
		// reading, until a real integration exists.
		weather: { tempF: 0, condition: 'Unavailable', icon: '—' }
	};
}

class FamilyStore {
	data = $state<FamilyData>(emptyFamilyData());
	config = $state<AppConfig>(defaultConfig);
	progress = $state<ProgressData>(emptyProgress());
	localEvents = $state<LocalEvent[]>([]);
	/** 'tv' (no touch — drive from a phone) or 'touch'; null before first boot's pick. */
	displayMode = $state<DisplayMode | null>(null);
	/** Family chose to set up Wi-Fi later. */
	wifiSkipped = $state(false);

	/** Touch devices get on-screen input; TV devices are driven from a phone. */
	get isTouch(): boolean {
		return this.displayMode === 'touch';
	}

	/** No touch means no way to dismiss anything shown over the display. */
	get isTv(): boolean {
		return this.displayMode === 'tv';
	}

	get profiles(): Profile[] {
		return this.data.profiles;
	}

	/** Real screen aspect ratio, kept live by `watchOrientation()` (started once
	 *  from the app shell). Used whenever the configured orientation is 'auto' —
	 *  a stored 'landscape'/'portrait' value goes stale the moment someone
	 *  physically rotates the panel, so auto-detecting from the real viewport is
	 *  the only way the layout reliably matches how the screen is mounted. */
	detectedOrientation = $state<'landscape' | 'portrait'>('landscape');

	get orientation(): 'landscape' | 'portrait' {
		const configured = this.config.view.orientation;
		return configured === 'auto' ? this.detectedOrientation : configured;
	}

	/** Track the real viewport aspect ratio via `matchMedia`. Browser-only —
	 *  call once from a client effect; returns the cleanup function. */
	watchOrientation(): () => void {
		if (typeof matchMedia !== 'function') return () => {};
		const mq = matchMedia('(orientation: portrait)');
		const update = () => (this.detectedOrientation = mq.matches ? 'portrait' : 'landscape');
		update();
		mq.addEventListener('change', update);
		return () => mq.removeEventListener('change', update);
	}

	/** Read-only TV mode — editing controls are hidden on the display. */
	get readOnly(): boolean {
		return this.config.kiosk.readOnly;
	}

	/**
	 * Apply persisted config (from config.json) onto the store. App config
	 * (features, view prefs, orientation) is applied wholesale; profiles are
	 * fully synced against `cfg.profiles` — updated in place if they already
	 * exist, added (with starter routines) if new, and dropped if removed —
	 * since profiles can arrive here either from the setup wizard or from
	 * in-app editing. No-op until setup is complete.
	 */
	applyConfig(cfg: PersistedConfigShape) {
		this.config = cfg.app;
		this.displayMode = cfg.displayMode ?? null;
		this.wifiSkipped = !!cfg.wifiSkipped;
		if (!cfg.setupComplete) return;
		if (cfg.family.name) this.data.familyName = cfg.family.name;
		this.data.weekStartsOn = cfg.family.weekStartsOn;

		const keep = new Set(cfg.profiles.map((pc) => pc.id));
		this.data.profiles = this.data.profiles.filter((p) => keep.has(p.id));
		for (const pc of cfg.profiles) {
			const p = this.data.profiles.find((x) => x.id === pc.id);
			if (p) {
				p.name = pc.name;
				p.nickname = pc.nickname;
				p.age = pc.age;
				p.role = pc.role;
				p.color = pc.color;
				p.avatarEmoji = pc.avatarEmoji;
				p.photoUpdatedAt = pc.photoUpdatedAt;
			} else {
				this.data.profiles.push({
					id: pc.id,
					name: pc.name,
					nickname: pc.nickname,
					age: pc.age,
					role: pc.role,
					color: pc.color,
					avatarEmoji: pc.avatarEmoji,
					photoUpdatedAt: pc.photoUpdatedAt,
					tasks: { done: 0, total: 0 }
				});
				this.seedRoutinesForProfile(pc.id, pc.age);
			}
		}
	}

	profile(id: number): Profile | undefined {
		return this.data.profiles.find((p) => p.id === id);
	}

	/** Events involving a profile (empty profileIds = household, shown to all). */
	eventsForProfile(id: number): FamilyEvent[] {
		return this.data.events.filter((e) => e.profileIds.length === 0 || e.profileIds.includes(id));
	}

	routinesForProfile(id: number): Routine[] {
		return this.data.routines.filter((r) => r.profileId === id);
	}

	routine(id: number): Routine | undefined {
		return this.data.routines.find((r) => r.id === id);
	}

	starsFor(id: number): number {
		return this.data.stars.find((s) => s.profileId === id)?.stars ?? 0;
	}

	feelingFor(id: number) {
		return this.data.feelingsToday.find((f) => f.profileId === id);
	}

	/**
	 * Apply persisted kid progress: today's step completions, streaks, and
	 * today's feelings. Past days remain queryable via feelingHistory().
	 */
	applyProgress(progress: ProgressData) {
		this.progress = progress;
		const today = dateKey();
		for (const r of this.data.routines) {
			const rp = progress.routines[r.id];
			if (rp) {
				r.streak = {
					current: rp.streakCurrent,
					longest: rp.streakLongest,
					lastCompletedDate: rp.lastCompletedDate
				};
				const doneToday = new Set(rp.completions[today] ?? []);
				for (const step of r.steps) step.done = doneToday.has(step.id);
			}
		}
		// Rebuild today's feelings from progress.
		this.data.feelingsToday = [];
		for (const [pid, byDate] of Object.entries(progress.feelings)) {
			const f = byDate[today];
			if (f) {
				this.data.feelingsToday.push({
					profileId: Number(pid),
					emoji: f.emoji,
					label: f.label,
					loggedAt: new Date()
				});
			}
		}
	}

	// Event id namespaces so different sources never clash:
	//   demo:   < 1,000,000
	//   synced: [1,000,000, 2,000,000)
	//   local:  [2,000,000, 3,000,000)
	static SYNCED_BASE = 1_000_000;
	static LOCAL_BASE = 2_000_000;

	/**
	 * Merge synced calendar events (from SQLite) into the store. Fully replaced
	 * on each apply (idempotent); leaves demo + local events untouched.
	 */
	applySyncedEvents(
		events: Array<{
			id: number;
			profileId?: number;
			startTs: number;
			endTs: number;
			allDay: boolean;
			title: string;
			location?: string;
		}>
	) {
		const B = FamilyStore.SYNCED_BASE;
		this.data.events = this.data.events.filter((e) => e.id < B || e.id >= FamilyStore.LOCAL_BASE);
		for (const e of events) {
			this.data.events.push({
				id: B + e.id,
				title: e.title,
				start: new Date(e.startTs * 1000),
				end: new Date(e.endTs * 1000),
				allDay: e.allDay,
				location: e.location,
				profileIds: e.profileId ? [e.profileId] : []
			});
		}
	}

	/** Re-materialize local (user-created) events into data.events. */
	private materializeLocalEvents() {
		const B = FamilyStore.LOCAL_BASE;
		this.data.events = this.data.events.filter((e) => e.id < B || e.id >= B + B);
		for (const e of this.localEvents) {
			this.data.events.push({
				id: B + e.id,
				title: e.title,
				start: new Date(e.startTs * 1000),
				end: new Date(e.endTs * 1000),
				allDay: e.allDay,
				location: e.location,
				profileIds: e.profileIds
			});
		}
	}

	/** Last `days` feelings for a profile, newest first. */
	feelingHistory(profileId: number, days = 7): { date: string; feeling: FeelingEntry }[] {
		const byDate = this.progress.feelings[profileId] ?? {};
		const out: { date: string; feeling: FeelingEntry }[] = [];
		const d = new Date();
		for (let i = 0; i < days; i++) {
			const key = dateKey(d);
			if (byDate[key]) out.push({ date: key, feeling: byDate[key] });
			d.setDate(d.getDate() - 1);
		}
		return out;
	}

	/** Seed age-appropriate default routines for a (new) profile. No-op for adults. */
	seedRoutinesForProfile(profileId: number, age: number) {
		const lib = defaultRoutinesForAge(age);
		let rid = this.data.routines.reduce((m, r) => Math.max(m, r.id), 0);
		let sid = this.data.routines.flatMap((r) => r.steps).reduce((m, s) => Math.max(m, s.id), 0);
		for (const lr of lib) {
			rid += 1;
			this.data.routines.push({
				id: rid,
				profileId,
				name: lr.name,
				timeOfDay: lr.timeOfDay,
				active: true,
				streak: { current: 0, longest: 0 },
				steps: lr.steps.map((ls, i) => {
					sid += 1;
					return {
						id: sid,
						icon: ls.icon,
						label: ls.label,
						estimatedMinutes: ls.estimatedMinutes,
						order: i + 1,
						done: false
					};
				})
			});
		}
	}

	/** Step ids currently marked done for a routine. */
	doneStepIds(routineId: number): number[] {
		return (
			this.routine(routineId)
				?.steps.filter((s) => s.done)
				.map((s) => s.id) ?? []
		);
	}

	/** Update a routine's streak from a server response. */
	setStreak(routineId: number, current: number, longest: number, lastCompletedDate?: string) {
		const r = this.routine(routineId);
		if (r) r.streak = { current, longest, lastCompletedDate };
	}

	/** Reflect a feelings check-in locally (after persisting). */
	setFeelingToday(profileId: number, emoji: string, label: string) {
		const existing = this.data.feelingsToday.find((f) => f.profileId === profileId);
		if (existing) {
			existing.emoji = emoji;
			existing.label = label;
		} else {
			this.data.feelingsToday.push({ profileId, emoji, label, loggedAt: new Date() });
		}
		const today = dateKey();
		if (!this.progress.feelings[profileId]) this.progress.feelings[profileId] = {};
		this.progress.feelings[profileId][today] = { emoji, label };
	}

	/** Toggle a routine step's completion (mutate in place → reactive). */
	toggleStep(routineId: number, stepId: number) {
		const routine = this.routine(routineId);
		const step = routine?.steps.find((s) => s.id === stepId);
		if (step) step.done = !step.done;
	}

	/** Whether every step of a routine is done. */
	routineComplete(routineId: number): boolean {
		const routine = this.routine(routineId);
		return !!routine && routine.steps.length > 0 && routine.steps.every((s) => s.done);
	}

	/** Snapshot the persistable parts of the store as a full config to save. */
	toPersisted(): PersistedConfigShape {
		return {
			setupComplete: true,
			displayMode: this.displayMode,
			wifiSkipped: this.wifiSkipped,
			family: {
				name: this.data.familyName,
				timezone: this.data.timezone,
				weekStartsOn: this.data.weekStartsOn
			},
			profiles: this.data.profiles.map((p) => ({
				id: p.id,
				name: p.name,
				nickname: p.nickname,
				age: p.age,
				role: p.role,
				color: p.color,
				avatarEmoji: p.avatarEmoji,
				photoUpdatedAt: p.photoUpdatedAt
			})),
			app: this.config
		};
	}

	/** Toggle a list item's completion (mutate in place → reactive). */
	toggleListItem(listId: number, itemId: number) {
		const list = this.data.lists.find((l) => l.id === listId);
		const it = list?.items.find((i) => i.id === itemId);
		if (it) it.completed = !it.completed;
	}

	/** Apply persisted meals + lists + local events + tasks + recipes + rewards. */
	applyFamilyData(
		data: {
			meals: FamilyData['meals'];
			lists: FamilyData['lists'];
			localEvents?: LocalEvent[];
			tasks?: FamilyData['tasks'];
			recipes?: FamilyData['recipes'];
			stars?: FamilyData['stars'];
			rewardClaims?: FamilyData['rewardClaims'];
		} | null
	) {
		if (!data) return;
		this.data.meals = data.meals;
		this.data.lists = data.lists;
		this.data.tasks = data.tasks ?? [];
		this.data.recipes = data.recipes ?? [];
		this.data.stars = data.stars ?? [];
		this.data.rewardClaims = data.rewardClaims ?? [];
		this.localEvents = data.localEvents ?? [];
		this.materializeLocalEvents();
	}

	/** Snapshot the persistable family content. */
	familyDataSnapshot() {
		return {
			meals: this.data.meals,
			lists: this.data.lists,
			localEvents: this.localEvents,
			tasks: this.data.tasks,
			recipes: this.data.recipes,
			stars: this.data.stars,
			rewardClaims: this.data.rewardClaims
		};
	}

	// --- Rewards ---
	reward(id: number): Reward | undefined {
		return this.data.rewards.find((r) => r.id === id);
	}
	/** Rewards a child can currently afford, cheapest first. */
	nextReward(profileId: number): Reward | undefined {
		const stars = this.starsFor(profileId);
		return this.data.rewards
			.filter((r) => r.active && r.starCost > stars)
			.sort((a, b) => a.starCost - b.starCost)[0];
	}
	claimsFor(profileId: number): RewardClaim[] {
		return this.data.rewardClaims
			.filter((c) => c.profileId === profileId)
			.sort((a, b) => b.ts - a.ts);
	}
	/** Redeem a reward: deduct stars and record the claim. Returns success. */
	claimReward(rewardId: number, profileId: number): boolean {
		const reward = this.reward(rewardId);
		if (!reward) return false;
		const balance = this.data.stars.find((s) => s.profileId === profileId);
		if (!balance || balance.stars < reward.starCost) return false;
		balance.stars -= reward.starCost;
		this.data.rewardClaims.push({
			id: this.nextId(this.data.rewardClaims),
			rewardId,
			profileId,
			rewardName: reward.name,
			icon: reward.icon,
			starCost: reward.starCost,
			ts: Date.now()
		});
		this.persistFamilyData();
		return true;
	}

	// --- Tasks ---
	tasksFor(profileId?: number): FamilyData['tasks'] {
		return profileId === undefined
			? this.data.tasks
			: this.data.tasks.filter((t) => t.profileId === profileId);
	}
	addTask(text: string, profileId?: number, dueDate?: string) {
		if (!text.trim()) return;
		this.data.tasks.push({
			id: this.nextId(this.data.tasks),
			text: text.trim(),
			done: false,
			profileId,
			dueDate
		});
		this.persistFamilyData();
	}
	toggleTask(id: number) {
		const t = this.data.tasks.find((x) => x.id === id);
		if (t) t.done = !t.done;
		this.persistFamilyData();
	}
	removeTask(id: number) {
		const i = this.data.tasks.findIndex((x) => x.id === id);
		if (i >= 0) this.data.tasks.splice(i, 1);
		this.persistFamilyData();
	}

	// --- Recipes ---
	addRecipe(r: Omit<FamilyData['recipes'][number], 'id'>): Recipe {
		const recipe = { ...r, id: this.nextId(this.data.recipes) };
		this.data.recipes.push(recipe);
		this.persistFamilyData();
		return recipe;
	}
	/** Find a saved recipe with the same source URL (avoid re-importing). */
	recipeByUrl(url: string): Recipe | undefined {
		return this.data.recipes.find((r) => r.sourceUrl && r.sourceUrl === url);
	}
	updateRecipe(id: number, r: Omit<FamilyData['recipes'][number], 'id'>) {
		const i = this.data.recipes.findIndex((x) => x.id === id);
		if (i >= 0) this.data.recipes[i] = { ...r, id };
		this.persistFamilyData();
	}
	removeRecipe(id: number) {
		const i = this.data.recipes.findIndex((x) => x.id === id);
		if (i >= 0) this.data.recipes.splice(i, 1);
		this.persistFamilyData();
	}

	/** Create a local (on-device) calendar event. */
	addLocalEvent(e: Omit<LocalEvent, 'id'>): LocalEvent {
		const id = this.localEvents.reduce((m, x) => Math.max(m, x.id), 0) + 1;
		const ev = { ...e, id };
		this.localEvents.push(ev);
		this.materializeLocalEvents();
		this.persistFamilyData();
		return ev;
	}

	removeLocalEvent(localId: number) {
		const i = this.localEvents.findIndex((x) => x.id === localId);
		if (i >= 0) this.localEvents.splice(i, 1);
		this.materializeLocalEvents();
		this.persistFamilyData();
	}

	/** Whether an event id is a user-created local event (vs demo/synced). */
	isLocalEventId(id: number): boolean {
		return id >= FamilyStore.LOCAL_BASE && id < FamilyStore.LOCAL_BASE + FamilyStore.LOCAL_BASE;
	}
	localIdOf(eventId: number): number {
		return eventId - FamilyStore.LOCAL_BASE;
	}

	private fdTimer?: ReturnType<typeof setTimeout>;
	/** Persist meals + lists to the server (debounced). Client-only. */
	persistFamilyData() {
		clearTimeout(this.fdTimer);
		this.fdTimer = setTimeout(() => {
			fetch('/api/family-data', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(this.familyDataSnapshot())
			}).catch(() => {});
		}, 400);
	}

	private nextId(items: { id: number }[]): number {
		return items.reduce((m, x) => Math.max(m, x.id), 0) + 1;
	}

	addListItem(listId: number, text: string) {
		const list = this.data.lists.find((l) => l.id === listId);
		if (!list || !text.trim()) return;
		list.items.push({ id: this.nextId(list.items), text: text.trim(), completed: false });
	}

	removeListItem(listId: number, itemId: number) {
		const list = this.data.lists.find((l) => l.id === listId);
		if (!list) return;
		const i = list.items.findIndex((x) => x.id === itemId);
		if (i >= 0) list.items.splice(i, 1);
	}

	addList(name: string, kind: FamilyData['lists'][number]['kind'] = 'custom', icon = '📝') {
		if (!name.trim()) return;
		this.data.lists.push({
			id: this.nextId(this.data.lists),
			name: name.trim(),
			kind,
			icon,
			items: []
		});
	}

	/** Set (or clear) the meal for a date + type. Optionally link a recipe. */
	setMeal(
		date: string,
		mealType: FamilyData['meals'][number]['mealType'],
		name: string,
		emoji: string,
		recipeId?: number
	) {
		const existing = this.data.meals.find((m) => m.date === date && m.mealType === mealType);
		if (!name.trim()) {
			if (existing) this.data.meals.splice(this.data.meals.indexOf(existing), 1);
			return;
		}
		if (existing) {
			existing.name = name.trim();
			existing.emoji = emoji;
			existing.recipeId = recipeId;
		} else {
			this.data.meals.push({
				id: this.nextId(this.data.meals),
				date,
				mealType,
				name: name.trim(),
				emoji,
				recipeId
			});
		}
	}

	/** Plan a saved recipe onto a specific day + meal slot. */
	planRecipe(date: string, mealType: FamilyData['meals'][number]['mealType'], recipe: Recipe) {
		this.setMeal(date, mealType, recipe.name, recipe.emoji, recipe.id);
		this.persistFamilyData();
	}
}

export const family = new FamilyStore();
