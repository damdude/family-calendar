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
import type { FamilyData, FamilyEvent, Profile, Routine } from '$lib/types';

class FamilyStore {
	data = $state<FamilyData>(demoFamily);
	config = $state<AppConfig>(defaultConfig);

	get profiles(): Profile[] {
		return this.data.profiles;
	}

	get orientation(): Orientation {
		return this.config.view.orientation;
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
}

export const family = new FamilyStore();
