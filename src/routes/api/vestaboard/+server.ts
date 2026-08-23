/**
 * Vestaboard content feed. Assembles the "smart" material the split-flap
 * screensaver rotates through that the client store doesn't already hold:
 * fresh headlines pulled from the family's Sites of Interest, plus a joke of
 * the day. Everything else (weather, events, kids) the board composes locally.
 */

import { json } from '@sveltejs/kit';
import { getSites } from '$lib/server/sites';
import { getUpcomingBirthdays } from '$lib/server/db/repo';
import type { RequestHandler } from './$types';

// Wholesome, kid-safe one-liners. Picked by day so it's stable for ~24h.
const JOKES: [string, string][] = [
	['WHY DID THE BICYCLE FALL OVER?', 'IT WAS TWO TIRED'],
	['WHAT DO YOU CALL FAKE SPAGHETTI?', 'AN IMPASTA'],
	['WHY CANT YOUR NOSE BE 12 INCHES?', 'THEN IT WOULD BE A FOOT'],
	['WHAT DO CLOUDS WEAR?', 'THUNDERWEAR'],
	['WHY DID THE MATH BOOK LOOK SAD?', 'IT HAD TOO MANY PROBLEMS'],
	['HOW DO YOU THROW A SPACE PARTY?', 'YOU PLANET'],
	['WHAT IS AN EGGS FAVOURITE DAY?', 'FRY-DAY'],
	['WHY WAS THE BROOM LATE?', 'IT OVER-SWEPT'],
	['WHAT DO YOU CALL A SLEEPING DINOSAUR?', 'A DINO-SNORE'],
	['WHY CANT A BIKE STAND ALONE?', 'IT IS TWO TIRED'],
	['WHAT IS A PIRATES FAVOURITE LETTER?', 'YOU THINK ITS R BUT ITS THE C'],
	['WHY DID THE COOKIE GO TO HOSPITAL?', 'IT FELT CRUMMY'],
	['WHAT DID ONE WALL SAY TO THE OTHER?', 'MEET YOU AT THE CORNER'],
	['HOW DOES THE OCEAN SAY HI?', 'IT WAVES']
];

export const GET: RequestHandler = async () => {
	// Fresh headlines from any Sites of Interest the family follows.
	const headlines: { source: string; text: string }[] = [];
	try {
		const sites = await getSites();
		for (const list of Object.values(sites)) {
			for (const s of list) {
				const source = (s.name || s.title || 'NEWS').toUpperCase();
				for (const item of s.items ?? []) {
					if (item && item.trim()) headlines.push({ source, text: item.trim() });
				}
				if ((!s.items || s.items.length === 0) && s.title) {
					headlines.push({ source, text: s.title });
				}
			}
		}
	} catch {
		// Sites feature disabled / no data — headlines stay empty.
	}

	const dayIndex = Math.floor(Date.now() / 86_400_000) % JOKES.length;
	const [jokeQ, jokeA] = JOKES[dayIndex];

	// Whatever's synced from a calendar the family flagged as a birthdays
	// feed (Settings → Calendars) — next 60 days, already recurrence-
	// expanded by the normal ICS sync, just filtered here.
	let birthdays: { title: string; startTs: number }[] = [];
	try {
		birthdays = getUpcomingBirthdays(60);
	} catch {
		/* no DB yet — no calendars subscribed at all */
	}

	return json({
		headlines: headlines.slice(0, 12),
		joke: { q: jokeQ, a: jokeA },
		birthdays
	});
};
