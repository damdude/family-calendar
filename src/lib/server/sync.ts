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

	const cfg = await loadConfig();
	const profiles = cfg.profiles.map((p) => ({ id: p.id, emails: p.emails ?? [] }));
	const sharedEmails = cfg.family.sharedEmails ?? [];

	let count = 0;
	const calendars = await listCalendars(accessToken);
	for (const cal of calendars) {
		const calId = upsertCalendar({
			provider: GOOGLE_PROVIDER,
			externalId: cal.id,
			name: cal.summary,
			colorHex: cal.backgroundColor
		});
		// upsertCalendar never overwrites a calendar's own profile_id (only a
		// fresh insert sets it), so this reads back whatever "For" the family
		// picked in Settings, if anything — the fallback below when an
		// event's own attendees give no match.
		const calendarProfileId = getCalendars(GOOGLE_PROVIDER).find((c) => c.id === calId)?.profileId;
		const events = await listEvents(accessToken, cal.id, timeMin, timeMax);
		for (const e of events) {
			const byAttendee = matchAttendees(e.attendees, profiles, sharedEmails);
			upsertEvent({
				calendarId: calId,
				externalId: e.externalId,
				startTs: e.startTs,
				endTs: e.endTs,
				allDay: e.allDay,
				title: e.title,
				description: e.description,
				location: e.location,
				profileIds: byAttendee ?? (calendarProfileId ? [calendarProfileId] : [])
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

/** Who a synced event is for, per an explicit request: match the invite's
 *  actual attendee list against each profile's registered address(es), not
 *  who organized it and not a name match in the title. An address shared
 *  by the whole household means the event is for everyone. Returns null —
 *  not [] — when there's nothing to go on (no ATTENDEE lines at all, or
 *  none of them match anything configured), so the caller can fall back to
 *  the older title/calendar heuristics below instead of misreading "no
 *  match" as "explicitly no one". */
function matchAttendees(
	attendees: string[],
	profiles: { id: number; emails: string[] }[],
	sharedEmails: string[]
): number[] | null {
	if (attendees.length === 0) return null;
	const invited = new Set(attendees);
	if (sharedEmails.some((addr) => invited.has(addr))) return [];
	const matched = profiles.filter((p) => p.emails.some((addr) => invited.has(addr))).map((p) => p.id);
	return matched.length ? matched : null;
}

/** Falls back to the pre-attendee-matching heuristics for a group of
 *  cross-calendar duplicate copies, when the invite itself gave no usable
 *  signal (no attendees registered, or the family hasn't entered anyone's
 *  email yet). The title is checked first ("look at subject to figure out
 *  which child this event is for") — a parent can easily have their kid's
 *  event on their own personal calendar too (invited as an attendee, not
 *  because the event is about them), which would otherwise make "landed on
 *  exactly one specific person's calendar" outrank an explicit name in the
 *  title. Confirmed on-device: a family Google Calendar's recurring
 *  practice also synced onto the inviting parent's own calendar came out
 *  tagged to the parent instead of the child actually named in the title.
 *  Only when the title names nobody does which calendar(s) it landed on
 *  decide it. */
function titleOrCalendarFallback(
	group: FetchedEvent[],
	profiles: { id: number; name: string }[]
): number[] | null {
	const title = group[0].e.title.toLowerCase();
	const named = profiles.find((p) => p.name && title.includes(p.name.toLowerCase()));
	if (named) return [named.id];

	const distinct = [...new Set(group.map((g) => g.cal.profileId).filter((id): id is number => !!id))];
	return distinct.length ? [distinct[0]] : null;
}

/** The sync step's full auto-tag guess for one group of same-event copies:
 *  attendee match first, then (only for the cross-calendar invite-copy
 *  case) the older title/calendar fallback. Null means neither had
 *  anything to go on — the caller falls back further, to each individual
 *  calendar's own configured "for" profile. */
function resolveAutoProfileIds(
	group: FetchedEvent[],
	profiles: { id: number; name: string; emails: string[] }[],
	sharedEmails: string[],
	spansCalendars: boolean
): number[] | null {
	const byAttendee = matchAttendees(group[0].e.attendees, profiles, sharedEmails);
	if (byAttendee !== null) return byAttendee;
	return spansCalendars ? titleOrCalendarFallback(group, profiles) : null;
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

	const cfg = await loadConfig();
	const profiles = cfg.profiles.map((p) => ({ id: p.id, name: p.name, emails: p.emails ?? [] }));
	const sharedEmails = cfg.family.sharedEmails ?? [];
	const groups = new Map<string, FetchedEvent[]>();
	for (const f of fetched) {
		const key = dedupKey(f.e);
		const list = groups.get(key);
		if (list) list.push(f);
		else groups.set(key, [f]);
	}

	// A phone-side local override (time/location/who) now lives in its own
	// table keyed by (calendar_id, external_id), not on the events row
	// itself — so clearing and re-inserting every row below (a full ICS
	// rebuild) doesn't touch it at all, nothing to snapshot/reapply here.
	for (const cal of okCals) clearCalendarEvents(cal.id);

	let count = 0;
	for (const group of groups.values()) {
		// Only collapse a "duplicate" when it actually spans more than one
		// calendar — that's the invite-copy scenario. Two same-titled,
		// same-timed entries within a single feed are left alone rather than
		// risking silently dropping a genuinely separate event.
		const spansCalendars = new Set(group.map((g) => g.cal.id)).size > 1;
		const toStore = spansCalendars ? [group[0]] : group;
		const autoProfileIds = resolveAutoProfileIds(group, profiles, sharedEmails, spansCalendars);

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
				profileIds: autoProfileIds ?? (cal.profileId ? [cal.profileId] : [])
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
