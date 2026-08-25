import { error } from '@sveltejs/kit';
import { isMirrorToken } from '$lib/server/mirror';
import { loadConfig } from '$lib/server/config';
import { loadFamilyData } from '$lib/server/familydata';
import { loadProgress } from '$lib/server/progress';
import { getSyncedEventsLean } from '$lib/server/db/repo';
import { generateAllRoutines } from '$lib/kid/routineLibrary';
import { dateKey } from '$lib/time';
import type { PageServerLoad } from './$types';

/** id offset so a synced event and a local event never collide as a list key
 *  (mirrors the client store's SYNCED_BASE/LOCAL_BASE convention). */
const LOCAL_ID_BASE = 1_000_000;

export const load: PageServerLoad = async ({ url }) => {
	const token = url.searchParams.get('token');
	if (!token || !isMirrorToken(token)) {
		throw error(410, 'This link has expired. Scan a fresh QR code from the display.');
	}

	const config = await loadConfig();
	const familyData = await loadFamilyData();
	const progress = await loadProgress();
	const today = dateKey();
	const routines = generateAllRoutines(config.profiles).map((r) => ({
		...r,
		doneStepIds: progress.routines[r.id]?.completions[today] ?? [],
		streakCurrent: progress.routines[r.id]?.streakCurrent ?? 0,
		streakLongest: progress.routines[r.id]?.streakLongest ?? 0
	}));

	const now = Math.floor(Date.now() / 1000);
	const from = now - 3600; // small back-window so an event already in progress still shows
	const to = now + 14 * 86_400;

	const synced = getSyncedEventsLean(from, to).map((e) => ({
		id: e.id,
		title: e.title,
		startTs: e.startTs,
		endTs: e.endTs,
		allDay: e.allDay,
		location: e.location,
		profileIds: e.profileIds,
		overridden: e.overridden
	}));
	const local = (familyData?.localEvents ?? [])
		.filter((e) => e.endTs > from && e.startTs < to)
		.map((e) => ({
			id: LOCAL_ID_BASE + e.id,
			title: e.title,
			startTs: e.startTs,
			endTs: e.endTs,
			allDay: e.allDay,
			location: e.location,
			profileIds: e.profileIds,
			overridden: false
		}));

	const events = [...synced, ...local].sort((a, b) => a.startTs - b.startTs);

	return {
		token,
		familyName: config.family.name,
		latitude: config.family.latitude,
		longitude: config.family.longitude,
		timezone: config.family.timezone,
		locationName: config.family.locationName,
		sleepStart: config.app.sleep.start,
		sleepEnd: config.app.sleep.end,
		sleepEnabled: config.app.sleep.enabled,
		idleMinutes: config.app.screensaver.idleMinutes,
		clock24h: config.app.view.clock24h,
		profiles: config.profiles.map((p) => ({
			id: p.id,
			name: p.name,
			age: p.age,
			role: p.role,
			color: p.color,
			avatarEmoji: p.avatarEmoji,
			emails: p.emails,
			photoUpdatedAt: p.photoUpdatedAt
		})),
		events,
		lists: familyData?.lists ?? [],
		tasks: familyData?.tasks ?? [],
		meals: familyData?.meals ?? [],
		recipes: familyData?.recipes ?? [],
		rewards: familyData?.rewards ?? [],
		stars: familyData?.stars ?? [],
		routines,
		// Full config, for the phone Settings tab's advanced sections (features,
		// orientation, routines, updates, parental lock, …) — those are posted
		// back wholesale to /api/config, same as the desktop Settings page.
		config
	};
};
