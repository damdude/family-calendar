/** Calendar sync orchestration (server-only). */

import {
	GOOGLE_PROVIDER,
	isGoogleConfigured,
	listCalendars,
	listEvents,
	refreshAccessToken
} from './google';
import { getOAuthToken, saveOAuthToken, upsertCalendar, upsertEvent } from './db/repo';

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

	const now = new Date();
	const timeMin = new Date(now);
	timeMin.setDate(timeMin.getDate() - 14);
	const timeMax = new Date(now);
	timeMax.setDate(timeMax.getDate() + 42);

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
