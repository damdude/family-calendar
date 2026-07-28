/**
 * Demo data — the ONLY place a literal family may appear (ADR-002).
 *
 * Production rendering never imports from src/lib/fake. The structure mirrors
 * the demo family on the Skylight reference box (two parents + two kids, ages 7
 * and 3) so the mockups match a real reference, with a dense, realistic week.
 *
 * Dates are resolved relative to the current week so "Today" is always
 * meaningful in the grid.
 */

import type {
	CustomList,
	FamilyData,
	FamilyEvent,
	FeelingLog,
	Meal,
	Profile,
	Reward,
	Routine
} from '$lib/types';

/** Midnight on the Monday of the current week (local time). */
function weekStartMonday(base = new Date()): Date {
	const d = new Date(base);
	d.setHours(0, 0, 0, 0);
	const dow = d.getDay(); // 0 Sun … 6 Sat
	const diff = (dow + 6) % 7; // days since Monday
	d.setDate(d.getDate() - diff);
	return d;
}

const MONDAY = weekStartMonday();

/** A Date at `dayOffset` (0 = Monday) and `hh:mm`. */
function at(dayOffset: number, hh: number, mm = 0): Date {
	const d = new Date(MONDAY);
	d.setDate(d.getDate() + dayOffset);
	d.setHours(hh, mm, 0, 0);
	return d;
}

/** YYYY-MM-DD for a day offset from Monday. */
function ymd(dayOffset: number): string {
	const d = new Date(MONDAY);
	d.setDate(d.getDate() + dayOffset);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
		d.getDate()
	).padStart(2, '0')}`;
}

// --- Profiles -------------------------------------------------------------

const profiles: Profile[] = [
	{
		id: 1,
		name: 'Eva',
		nickname: 'Mom',
		age: 38,
		role: 'parent',
		color: 'pink',
		avatarEmoji: '👩🏻',
		tasks: { done: 2, total: 5 }
	},
	{
		id: 2,
		name: 'Rahul',
		nickname: 'Dad',
		age: 40,
		role: 'parent',
		color: 'sage',
		avatarEmoji: '👨🏻',
		tasks: { done: 4, total: 4 }
	},
	{
		id: 3,
		name: 'Revansh',
		age: 7,
		role: 'child',
		color: 'sky',
		avatarEmoji: '👦🏻',
		tasks: { done: 2, total: 3 }
	},
	{
		id: 4,
		name: 'Enaya',
		age: 3,
		role: 'child',
		color: 'lavender',
		avatarEmoji: '👧🏻',
		tasks: { done: 2, total: 4 }
	}
];

// --- Events (a dense, realistic week) -------------------------------------

let eid = 0;
const ev = (
	title: string,
	profileIds: number[],
	start: Date,
	end: Date,
	extra: Partial<FamilyEvent> = {}
): FamilyEvent => ({ id: ++eid, title, profileIds, start, end, allDay: false, ...extra });

const events: FamilyEvent[] = [
	// Multi-day + all-day markers
	ev('Camping Trip', [1, 2, 3, 4], at(1, 0), at(2, 23, 59), { allDay: true }),
	ev('Garbage / Recycling Day', [], at(4, 0), at(4, 23, 59), { allDay: true }),

	// Monday (today)
	ev('Dentist', [1], at(0, 9, 30), at(0, 10, 15), { location: 'Downtown Dental' }),
	ev('Swim Practice', [3], at(0, 16, 0), at(0, 17, 0)),

	// Tuesday
	ev('Board Meeting', [2], at(1, 10, 0), at(1, 11, 30)),
	ev('Coffee Meeting with Diane', [1], at(1, 11, 30), at(1, 13, 0)),
	ev('Tutoring', [3], at(1, 15, 0), at(1, 16, 0)),

	// Wednesday
	ev('Playdate', [4], at(2, 10, 0), at(2, 11, 30)),
	ev("Amelia's Baby Shower", [1], at(2, 14, 0), at(2, 17, 0)),

	// Thursday
	ev('Drop Off', [3, 4], at(3, 8, 30), at(3, 9, 30), { location: 'School' }),
	ev('Assembly', [3], at(3, 9, 15), at(3, 10, 15)),
	ev('History Test', [3], at(3, 10, 30), at(3, 11, 30)),
	ev('Pest Control', [2], at(3, 12, 15), at(3, 14, 15)),
	ev('Study Group', [3], at(3, 15, 15), at(3, 17, 0)),

	// Friday
	ev('Drop Off Dry Cleaning', [1], at(4, 8, 30), at(4, 9, 30)),
	ev('Pep Rally!', [1], at(4, 11, 0), at(4, 12, 30)),
	ev('Orthodontist', [3], at(4, 13, 15), at(4, 14, 15)),
	ev('Violin Lesson', [4], at(4, 16, 0), at(4, 17, 0)),

	// Saturday
	ev('Horseback Riding', [4], at(5, 9, 0), at(5, 10, 0)),
	ev("Hayden's 10th Birthday Party", [3, 4], at(5, 11, 30), at(5, 14, 30)),
	ev('Soccer Game', [3], at(5, 15, 0), at(5, 17, 0)),

	// Sunday
	ev('Grocery Run', [2], at(6, 10, 0), at(6, 11, 0)),
	ev('Family Dinner Prep', [1], at(6, 16, 0), at(6, 17, 0))
];

// --- Routines -------------------------------------------------------------

let sid = 0;
const step = (
	icon: Routine['steps'][number]['icon'],
	label: string,
	estimatedMinutes: number,
	done = false
) => ({ id: ++sid, icon, label, estimatedMinutes, order: sid, done });

const routines: Routine[] = [
	{
		id: 1,
		profileId: 3, // Liam (7) — school-age, icon + text
		name: 'Morning Routine',
		timeOfDay: 'morning',
		active: true,
		streak: { current: 5, longest: 12, lastCompletedDate: ymd(-1) },
		steps: [
			step('bed', 'Make Bed', 2, true),
			step('toothbrush', 'Brush Teeth', 2, true),
			step('shirt', 'Get Dressed', 5, false),
			step('plate', 'Eat Breakfast', 15, false),
			step('backpack', 'Pack Backpack', 3, false),
			step('shoes', 'Put on Shoes', 2, false)
		]
	},
	{
		id: 2,
		profileId: 3,
		name: 'Bedtime Routine',
		timeOfDay: 'evening',
		active: true,
		streak: { current: 8, longest: 20, lastCompletedDate: ymd(-1) },
		steps: [
			step('bath', 'Take a Bath', 15, false),
			step('shirt', 'Put on Pajamas', 5, false),
			step('toothbrush', 'Brush Teeth', 2, false),
			step('book', 'Read a Story', 10, false),
			step('moon', 'Lights Out', 1, false)
		]
	},
	{
		id: 3,
		profileId: 4, // Harper (3) — pre-reader, icon only
		name: 'Morning Routine',
		timeOfDay: 'morning',
		active: true,
		streak: { current: 3, longest: 7, lastCompletedDate: ymd(-1) },
		steps: [
			step('sun', 'Wake Up', 1, true),
			step('bath', 'Potty', 3, true),
			step('toothbrush', 'Brush Teeth', 2, false),
			step('shirt', 'Get Dressed', 5, false),
			step('plate', 'Breakfast', 15, false),
			step('shoes', 'Shoes On', 2, false)
		]
	},
	{
		id: 4,
		profileId: 4,
		name: 'Bedtime Routine',
		timeOfDay: 'evening',
		active: true,
		streak: { current: 4, longest: 9, lastCompletedDate: ymd(-1) },
		steps: [
			step('bath', 'Bath Time', 15, false),
			step('shirt', 'Pajamas', 5, false),
			step('toothbrush', 'Brush Teeth', 2, false),
			step('book', 'Story Time', 10, false),
			step('moon', 'Goodnight', 1, false)
		]
	}
];

// --- Rewards + stars ------------------------------------------------------

const rewards: Reward[] = [
	{ id: 1, name: 'Extra Screen Time', starCost: 5, active: true, icon: '📱' },
	{ id: 2, name: 'Choose Dinner', starCost: 8, active: true, icon: '🍕' },
	{ id: 3, name: 'Movie Night', starCost: 10, active: true, icon: '🎬' },
	{ id: 4, name: 'Ice Cream Trip', starCost: 15, active: true, icon: '🍦' },
	{ id: 5, name: 'New Toy', starCost: 25, active: true, icon: '🧸' },
	{ id: 6, name: 'Trip to the Zoo', starCost: 30, active: true, icon: '🦁' }
];

const stars = [
	{ profileId: 3, stars: 12 },
	{ profileId: 4, stars: 7 }
];

// --- Feelings -------------------------------------------------------------

const feelingsToday: FeelingLog[] = [
	{ profileId: 3, emoji: '🤩', label: 'Excited', loggedAt: at(0, 7, 45) },
	{ profileId: 4, emoji: '😊', label: 'Happy', loggedAt: at(0, 7, 50) }
];

// --- Lists ----------------------------------------------------------------

let lid = 0;
const item = (text: string, completed = false, completedBy?: number) => ({
	id: ++lid,
	text,
	completed,
	completedBy
});

const lists: CustomList[] = [
	{
		id: 1,
		name: 'Groceries',
		kind: 'grocery',
		icon: '🛒',
		items: [
			item('Milk', true, 2),
			item('Eggs'),
			item('Bananas', true, 1),
			item('Bread'),
			item('Chicken breast'),
			item('Pasta'),
			item('Apples'),
			item('Greek yogurt')
		]
	},
	{
		id: 2,
		name: 'To-Do',
		kind: 'todo',
		icon: '✅',
		items: [
			item('Call the plumber'),
			item("RSVP to Hayden's party", true, 1),
			item('Renew library books', true, 1),
			item('Water the plants'),
			item('Book dentist for Harper')
		]
	},
	{
		id: 3,
		name: 'Camping Packing',
		kind: 'packing',
		icon: '🎒',
		items: [
			item('Tent', true, 2),
			item('Sleeping bags', true, 2),
			item('Flashlight'),
			item('Marshmallows'),
			item('Bug spray'),
			item('First aid kit')
		]
	}
];

// --- Meals ----------------------------------------------------------------

let mid = 0;
const meal = (
	dayOffset: number,
	mealType: Meal['mealType'],
	name: string,
	emoji: string
): Meal => ({
	id: ++mid,
	date: ymd(dayOffset),
	mealType,
	name,
	emoji
});

const meals: Meal[] = [
	meal(0, 'breakfast', 'Oatmeal & Berries', '🥣'),
	meal(0, 'dinner', 'Spaghetti Bolognese', '🍝'),
	meal(1, 'dinner', 'Taco Night', '🌮'),
	meal(2, 'dinner', 'Campfire Hot Dogs', '🌭'),
	meal(3, 'lunch', 'Turkey Sandwiches', '🥪'),
	meal(3, 'dinner', 'Grilled Chicken & Veg', '🍗'),
	meal(4, 'dinner', 'Homemade Pizza', '🍕'),
	meal(5, 'breakfast', 'Pancakes', '🥞'),
	meal(5, 'dinner', 'Backyard Burgers', '🍔'),
	meal(6, 'breakfast', 'Waffles', '🧇'),
	meal(6, 'dinner', 'Sunday Roast', '🍖')
];

// --- Assembled dataset ----------------------------------------------------

export const demoFamily: FamilyData = {
	familyName: 'Sharma Family',
	timezone: 'America/New_York',
	weekStartsOn: 1,
	profiles,
	events,
	routines,
	rewards,
	stars,
	feelingsToday,
	lists,
	meals,
	weather: { tempF: 68, condition: 'Partly Cloudy', icon: '⛅' }
};
