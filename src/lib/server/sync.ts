/** Calendar sync orchestration (server-only). */

import {
	GOOGLE_PROVIDER,
	isGoogleConfigured,
	listCalendars,
	listEvents,
	refreshAccessToken
} from './google';
import { fetchIcsEvents } from './ical';
import {
	clearCalendarEvents,
	getCalendars,
	getOAuthToken,
	saveOAuthToken,
	setCalendarSynced,
	upsertCalendar,
	upsertEvent
} from './db/repo';

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
export async function syncIcal(): Promise<number> {
	const cals = getCalendars('ical');
	if (cals.length === 0) return 0;
	const { min, max } = syncWindow();

	let count = 0;
	for (const cal of cals) {
		try {
			const events = await fetchIcsEvents(cal.externalId, min, max);
			clearCalendarEvents(cal.id);
			for (const e of events) {
				upsertEvent({
					calendarId: cal.id,
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
			setCalendarSynced(cal.id);
		} catch {
			// Leave the last good events in place if a feed is temporarily down.
		}
	}
	return count;
}

/** Sync every connected source (Google OAuth + ICS links). */
export async function syncAll(): Promise<number> {
	const [g, i] = await Promise.all([syncGoogle().catch(() => 0), syncIcal().catch(() => 0)]);
	return g + i;
}
