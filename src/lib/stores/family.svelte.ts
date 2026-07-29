/**
 * Reactive family store (runes).
 *
 * Seeded from demo data today; in later batches the SSE layer mutates `data`
 * in place (mutate-don't-spread — the home-display pattern) so the whole UI
 * stays reactive without re-assigning the root object.
 *
 * This is the single source the UI reads from; components never import
 * src/lib/fake directly.
 */

import { demoFamily } from '$lib/fake/family';
import {
	defaultConfig,
	type AppConfig,
	type Orientation,
	type PersistedConfigShape
} from '$lib/config';
import { emptyProgress, type FeelingEntry, type ProgressData } from '$lib/kid/progress';
import { defaultRoutinesForAge } from '$lib/kid/routineLibrary';
import { dateKey } from '$lib/time';
import type { FamilyData, FamilyEvent, Profile, Routine } from '$lib/types';

export interface LocalEvent {
	id: number;
	title: string;
	startTs: number;
	endTs: number;
	allDay: boolean;
	location?: string;
	profileIds: number[];
}

class FamilyStore {
	data = $state<FamilyData>(demoFamily);
	config = $state<AppConfig>(defaultConfig);
	progress = $state<ProgressData>(emptyProgress());
	localEvents = $state<LocalEvent[]>([]);

	get profiles(): Profile[] {
		return this.data.profiles;
	}

	get orientation(): Orientation {
		return this.config.view.orientation;
	}

	/** Read-only TV mode — editing controls are hidden on the display. */
	get readOnly(): boolean {
		return this.config.kiosk.readOnly;
	}

	/**
	 * Apply persisted config (from config.json) onto the demo-seeded store.
	 * App config (features, view prefs, orientation) is applied wholesale;
	 * family name and matching profiles' display fields are overridden in place
	 * so the curated calendar demo (events/routines keyed by profile id) stays
	 * intact. No-op until setup is complete.
	 */
	applyConfig(cfg: PersistedConfigShape) {
		this.config = cfg.app;
		if (!cfg.setupComplete) return;
		if (cfg.family.name) this.data.familyName = cfg.family.name;
		this.data.weekStartsOn = cfg.family.weekStartsOn;
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

	/** Apply persisted meals + lists + local events over the demo data. */
	applyFamilyData(
		data: {
			meals: FamilyData['meals'];
			lists: FamilyData['lists'];
			localEvents?: LocalEvent[];
		} | null
	) {
		if (!data) return;
		this.data.meals = data.meals;
		this.data.lists = data.lists;
		this.localEvents = data.localEvents ?? [];
		this.materializeLocalEvents();
	}

	/** Snapshot meals + lists + local events for persistence. */
	familyDataSnapshot() {
		return {
			meals: this.data.meals,
			lists: this.data.lists,
			localEvents: this.localEvents
		};
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

	/** Set (or clear) the meal for a date + type. */
	setMeal(
		date: string,
		mealType: FamilyData['meals'][number]['mealType'],
		name: string,
		emoji: string
	) {
		const existing = this.data.meals.find((m) => m.date === date && m.mealType === mealType);
		if (!name.trim()) {
			if (existing) this.data.meals.splice(this.data.meals.indexOf(existing), 1);
			return;
		}
		if (existing) {
			existing.name = name.trim();
			existing.emoji = emoji;
		} else {
			this.data.meals.push({
				id: this.nextId(this.data.meals),
				date,
				mealType,
				name: name.trim(),
				emoji
			});
		}
	}
}

export const family = new FamilyStore();
