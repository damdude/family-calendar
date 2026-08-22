/** Calendar sync orchestration (server-only). */

import {
	GOOGLE_PROVIDER,
	isGoogleConfigured,
	listCalendars,
	listEvents,
	refreshAccessToken
} from './google';
import { fetchIcsEvents, type IcsEvent } from './ical';
import {
	clearCalendarEvents,
	getCalendars,
	getOAuthToken,
	saveOAuthToken,
	setCalendarSynced,
	upsertCalendar,
	upsertEvent,
	type CalendarRow
} from './db/repo';
import { loadConfig } from './config';

/** The window we sync events within: 2 weeks back, 6 weeks forward. */
function syncWindow(): { min: Date; max: Date } {
	const now = new Date();
	const min = new Date(now);
	min.setDate(min.getDate() - 14);
	const max = new Date(now);
	max.setDate(max.getDate() + 42);
	return { min, max };
}

/** Return a valid Google access token, refreshing (and persisting) if needed. */
async function validGoogleAccessToken(): Promise<string | null> {
	const token = getOAuthToken(GOOGLE_PROVIDER);
	if (!token) return null;
	const now = Math.floor(Date.now() / 1000);
	if (token.accessToken && token.accessExpiresAt && token.accessExpiresAt - 60 > now) {
		return token.accessToken;
	}
	const refreshed = await refreshAccessToken(token.refreshToken);
	saveOAuthToken({
		...token,
		accessToken: refreshed.accessToken,
		accessExpiresAt: now + refreshed.expiresIn
	});
	return refreshed.accessToken;
}

export function isGoogleConnected(): boolean {
	return isGoogleConfigured() && !!getOAuthToken(GOOGLE_PROVIDER);
}

/**
 * Pull Google calendars + events for a window around today into SQLite.
 * Returns the number of events synced. No-op (0) when not connected.
 */
export async function syncGoogle(): Promise<number> {
	if (!isGoogleConfigured()) return 0; // don't touch the DB until configured
	const accessToken = await validGoogleAccessToken();
	if (!accessToken) return 0;

	const { min: timeMin, max: timeMax } = syncWindow();

	let count = 0;
	const calendars = await listCalendars(accessToken);
	for (const cal of calendars) {
		const calId = upsertCalendar({
			provider: GOOGLE_PROVIDER,
			externalId: cal.id,
			name: cal.summary,
			colorHex: cal.backgroundColor
		});
		const events = await listEvents(accessToken, cal.id, timeMin, timeMax);
		for (const e of events) {
			upsertEvent({
				calendarId: calId,
				externalId: e.externalId,
				startTs: e.startTs,
				endTs: e.endTs,
				allDay: e.allDay,
				title: e.title,
				description: e.description,
				location: e.location
			});
			count += 1;
		}
	}
	return count;
}

/**
 * Sync all ICS/webcal subscriptions. Each feed is fully re-materialized within
 * the window (removed/changed occurrences drop out). Returns events synced.
 */
/** One calendar's fetched-but-not-yet-stored event, kept with its source
 *  calendar for the cross-calendar dedup pass below. */
interface FetchedEvent {
	cal: CalendarRow;
	e: IcsEvent;
}

/** Same title + same start + same end, synced from two different calendars,
 *  is the same real-world event shared via a calendar invite (e.g. a parent
 *  invited a child) — not two coincidentally identical events. Case/
 *  whitespace-insensitive so "Piano Lesson " vs "piano lesson" still merge. */
function dedupKey(e: IcsEvent): string {
	return `${e.title.trim().toLowerCase()}|${e.startTs}|${e.endTs}`;
}

/** Pick which family member a group of duplicate copies is actually for.
 *  The title is checked first ("look at subject to figure out which child
 *  this event is for") — a parent can easily have their kid's event on
 *  their own personal calendar too (invited as an attendee, not because the
 *  event is about them), which would otherwise make "landed on exactly one
 *  specific person's calendar" outrank an explicit name in the title.
 *  Confirmed on-device: a family Google Calendar's recurring practice also
 *  synced onto the inviting parent's own calendar came out tagged to the
 *  parent instead of the child actually named in the title. Only when the
 *  title names nobody does which calendar(s) it landed on decide it. */
function resolveProfileId(
	group: FetchedEvent[],
	profiles: { id: number; name: string }[]
): number | undefined {
	const title = group[0].e.title.toLowerCase();
	const named = profiles.find((p) => p.name && title.includes(p.name.toLowerCase()));
	if (named) return named.id;

	const distinct = [...new Set(group.map((g) => g.cal.profileId).filter((id): id is number => !!id))];
	if (distinct.length >= 1) return distinct[0];
	return group[0].cal.profileId ?? undefined;
}

export async function syncIcal(): Promise<number> {
	const cals = getCalendars('ical');
	if (cals.length === 0) return 0;
	const { min, max } = syncWindow();

	// Fetch every calendar before writing anything — the same real-world
	// event can be synced separately onto two family members' calendars
	// (e.g. a parent invited a child to it), and catching that needs to see
	// all calendars' events together, not one feed at a time.
	const fetched: FetchedEvent[] = [];
	const okCals: CalendarRow[] = [];
	for (const cal of cals) {
		try {
			const events = await fetchIcsEvents(cal.externalId, min, max);
			for (const e of events) fetched.push({ cal, e });
			okCals.push(cal);
		} catch {
			// Leave that calendar's last good events in place if its feed is
			// temporarily down; still processes the rest.
		}
	}
	if (okCals.length === 0) return 0;

	const profiles = (await loadConfig()).profiles.map((p) => ({ id: p.id, name: p.name }));
	const groups = new Map<string, FetchedEvent[]>();
	for (const f of fetched) {
		const key = dedupKey(f.e);
		const list = groups.get(key);
		if (list) list.push(f);
		else groups.set(key, [f]);
	}

	for (const cal of okCals) clearCalendarEvents(cal.id);

	let count = 0;
	for (const group of groups.values()) {
		// Only collapse a "duplicate" when it actually spans more than one
		// calendar — that's the invite-copy scenario. Two same-titled,
		// same-timed entries within a single feed are left alone rather than
		// risking silently dropping a genuinely separate event.
		const spansCalendars = new Set(group.map((g) => g.cal.id)).size > 1;
		const toStore = spansCalendars ? [group[0]] : group;
		const profileId = spansCalendars ? resolveProfileId(group, profiles) : undefined;

		for (const { cal, e } of toStore) {
			upsertEvent({
				calendarId: cal.id,
				externalId: e.externalId,
				startTs: e.startTs,
				endTs: e.endTs,
				allDay: e.allDay,
				title: e.title,
				description: e.description,
				location: e.location,
				profileId: profileId ?? cal.profileId ?? undefined
			});
			count += 1;
		}
	}
	for (const cal of okCals) setCalendarSynced(cal.id);
	return count;
}

/** Sync every connected source (Google OAuth + ICS links). */
export async function syncAll(): Promise<number> {
	const [g, i] = await Promise.all([syncGoogle().catch(() => 0), syncIcal().catch(() => 0)]);
	return g + i;
}
