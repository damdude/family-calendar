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
