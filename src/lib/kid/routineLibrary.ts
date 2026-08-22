/**
 * Age-appropriate default routine library.
 *
 * When a child profile is created, we seed sensible morning/evening routines
 * from here (icon + label + estimated minutes per step) so the family isn't
 * staring at a blank kid mode. Families edit freely afterward.
 *
 * Client-safe data module (no server imports).
 */

import type { RoutineIcon, RoutineTimeOfDay } from '$lib/types';
import { routinesOn } from '$lib/types';

export interface LibraryStep {
	icon: RoutineIcon;
	label: string;
	estimatedMinutes: number;
}
export interface LibraryRoutine {
	name: string;
	timeOfDay: RoutineTimeOfDay;
	steps: LibraryStep[];
}

const s = (icon: RoutineIcon, label: string, estimatedMinutes: number): LibraryStep => ({
	icon,
	label,
	estimatedMinutes
});

/** Pre-reader (≈2–4): short, icon-first, no reading required. */
const preReader: LibraryRoutine[] = [
	{
		name: 'Morning Routine',
		timeOfDay: 'morning',
		steps: [
			s('sun', 'Wake Up', 1),
			s('bath', 'Potty', 3),
			s('toothbrush', 'Brush Teeth', 2),
			s('shirt', 'Get Dressed', 5),
			s('plate', 'Breakfast', 15),
			s('shoes', 'Shoes On', 2)
		]
	},
	{
		name: 'Bedtime Routine',
		timeOfDay: 'evening',
		steps: [
			s('bath', 'Bath Time', 15),
			s('shirt', 'Pajamas', 5),
			s('toothbrush', 'Brush Teeth', 2),
			s('book', 'Story Time', 10),
			s('moon', 'Goodnight', 1)
		]
	}
];

/** School-age (≈5–10): icon + text, adds school-prep steps. */
const schoolAge: LibraryRoutine[] = [
	{
		name: 'Morning Routine',
		timeOfDay: 'morning',
		steps: [
			s('bed', 'Make Bed', 2),
			s('toothbrush', 'Brush Teeth', 2),
			s('shirt', 'Get Dressed', 5),
			s('plate', 'Eat Breakfast', 15),
			s('backpack', 'Pack Backpack', 3),
			s('shoes', 'Put on Shoes', 2)
		]
	},
	{
		name: 'Bedtime Routine',
		timeOfDay: 'evening',
		steps: [
			s('bath', 'Take a Bath', 15),
			s('shirt', 'Put on Pajamas', 5),
			s('toothbrush', 'Brush Teeth', 2),
			s('book', 'Read a Story', 10),
			s('moon', 'Lights Out', 1)
		]
	}
];

/** Tween/teen (≈11–17): more independence, adds self-care + planning. */
const olderKid: LibraryRoutine[] = [
	{
		name: 'Morning Routine',
		timeOfDay: 'morning',
		steps: [
			s('bed', 'Make Bed', 2),
			s('bath', 'Shower', 10),
			s('toothbrush', 'Brush Teeth', 2),
			s('brush-hair', 'Brush Hair', 2),
			s('plate', 'Eat Breakfast', 15),
			s('backpack', 'Pack Bag', 3)
		]
	},
	{
		name: 'Evening Routine',
		timeOfDay: 'evening',
		steps: [
			s('book', 'Homework', 30),
			s('lunchbox', 'Prep Tomorrow', 5),
			s('bath', 'Shower', 10),
			s('toothbrush', 'Brush Teeth', 2),
			s('moon', 'Lights Out', 1)
		]
	}
];

/** Default routines for a child of the given age. Empty for adults. */
export function defaultRoutinesForAge(age: number): LibraryRoutine[] {
	if (age >= 18) return [];
	if (age < 5) return preReader;
	if (age <= 10) return schoolAge;
	return olderKid;
}

export interface GeneratedStep {
	id: number;
	icon: RoutineIcon;
	label: string;
	estimatedMinutes: number;
	order: number;
}
export interface GeneratedRoutine {
	id: number;
	profileId: number;
	name: string;
	timeOfDay: RoutineTimeOfDay;
	steps: GeneratedStep[];
}

/** Deterministically regenerate every enabled profile's routines in one pass.
 *  Routines have no server persistence of their own (routinesEnabled is the
 *  thing that's saved) — both the display (family.svelte.ts's per-profile
 *  seedRoutinesForProfile, called once per profile in config.profiles order)
 *  and the phone companion's server-side load need to land on the SAME ids
 *  for a step toggle on one to match the right progress.json entry read by
 *  the other, so this mirrors that exact iteration/numbering scheme: only
 *  profiles with routines on are visited, in the given array's order, with
 *  routine/step ids assigned incrementally as they're encountered. */
export function generateAllRoutines(
	profiles: { id: number; age: number; role: 'parent' | 'child'; routinesEnabled?: boolean }[]
): GeneratedRoutine[] {
	const out: GeneratedRoutine[] = [];
	let rid = 0;
	let sid = 0;
	for (const p of profiles) {
		if (!routinesOn(p)) continue;
		for (const lr of defaultRoutinesForAge(p.age)) {
			rid += 1;
			out.push({
				id: rid,
				profileId: p.id,
				name: lr.name,
				timeOfDay: lr.timeOfDay,
				steps: lr.steps.map((ls, i) => {
					sid += 1;
					return {
						id: sid,
						icon: ls.icon,
						label: ls.label,
						estimatedMinutes: ls.estimatedMinutes,
						order: i + 1
					};
				})
			});
		}
	}
	return out;
}
