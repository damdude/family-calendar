import { error } from '@sveltejs/kit';
import { isMirrorToken } from '$lib/server/mirror';
import { loadConfig } from '$lib/server/config';
import { loadFamilyData } from '$lib/server/familydata';
import { getSyncedEventsLean } from '$lib/server/db/repo';
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
		profileIds: e.profileId ? [e.profileId] : []
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
			profileIds: e.profileIds
		}));

	const events = [...synced, ...local].sort((a, b) => a.startTs - b.startTs);

	return {
		token,
		familyName: config.family.name,
		latitude: config.family.latitude,
		longitude: config.family.longitude,
		timezone: config.family.timezone,
		profiles: config.profiles.map((p) => ({
			id: p.id,
			name: p.name,
			age: p.age,
			color: p.color,
			avatarEmoji: p.avatarEmoji,
			photoUpdatedAt: p.photoUpdatedAt
		})),
		events,
		lists: familyData?.lists ?? [],
		tasks: familyData?.tasks ?? []
	};
};
