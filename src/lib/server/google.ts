/**
 * Google Calendar OAuth 2.0 **device flow** + read-only sync. Server-only.
 *
 * No callback URL needed (ideal for a keyboard-light Pi): the Pi shows a code,
 * the user enters it at google.com/device, the Pi polls for tokens. The refresh
 * token is stored ENCRYPTED (repo.saveOAuthToken).
 *
 * Requires GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET in the
 * environment (a Google Cloud "TVs and Limited Input" OAuth client). Without
 * them every call throws a clear, actionable error — nothing is hardcoded.
 */

const DEVICE_CODE_URL = 'https://oauth2.googleapis.com/device/code';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const DEVICE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code';

export const GOOGLE_PROVIDER = 'google';

function creds(): { clientId: string; clientSecret: string } {
	const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
	const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
	if (!clientId || !clientSecret) {
		throw new Error(
			'Google Calendar is not configured. Add GOOGLE_OAUTH_CLIENT_ID and ' +
				'GOOGLE_OAUTH_CLIENT_SECRET to .env (create a "TVs and Limited Input" ' +
				'OAuth client in Google Cloud).'
		);
	}
	return { clientId, clientSecret };
}

export function isGoogleConfigured(): boolean {
	return !!(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);
}

export interface DeviceCode {
	deviceCode: string;
	userCode: string;
	verificationUrl: string;
	expiresIn: number;
	interval: number;
}

/** Step 1: request a device + user code to show on the Pi. */
export async function startDeviceFlow(): Promise<DeviceCode> {
	const { clientId } = creds();
	const res = await fetch(DEVICE_CODE_URL, {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({ client_id: clientId, scope: CALENDAR_SCOPE })
	});
	if (!res.ok) throw new Error(`device code request failed: ${res.status}`);
	const j = await res.json();
	return {
		deviceCode: j.device_code,
		userCode: j.user_code,
		verificationUrl: j.verification_url ?? j.verification_uri,
		expiresIn: j.expires_in,
		interval: j.interval ?? 5
	};
}

export type PollResult =
	| { status: 'pending' }
	| { status: 'slow_down' }
	| { status: 'granted'; refreshToken: string; accessToken: string; expiresIn: number }
	| { status: 'denied' | 'expired'; error: string };

/** Step 2: poll once for the token after the user enters the code. */
export async function pollDeviceToken(deviceCode: string): Promise<PollResult> {
	const { clientId, clientSecret } = creds();
	const res = await fetch(TOKEN_URL, {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			client_id: clientId,
			client_secret: clientSecret,
			device_code: deviceCode,
			grant_type: DEVICE_GRANT
		})
	});
	const j = await res.json();
	if (res.ok) {
		return {
			status: 'granted',
			refreshToken: j.refresh_token,
			accessToken: j.access_token,
			expiresIn: j.expires_in
		};
	}
	switch (j.error) {
		case 'authorization_pending':
			return { status: 'pending' };
		case 'slow_down':
			return { status: 'slow_down' };
		case 'access_denied':
			return { status: 'denied', error: j.error };
		default:
			return { status: 'expired', error: j.error ?? 'unknown' };
	}
}

/** Exchange a refresh token for a fresh access token. */
export async function refreshAccessToken(
	refreshToken: string
): Promise<{ accessToken: string; expiresIn: number }> {
	const { clientId, clientSecret } = creds();
	const res = await fetch(TOKEN_URL, {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			client_id: clientId,
			client_secret: clientSecret,
			refresh_token: refreshToken,
			grant_type: 'refresh_token'
		})
	});
	if (!res.ok) throw new Error(`token refresh failed: ${res.status}`);
	const j = await res.json();
	return { accessToken: j.access_token, expiresIn: j.expires_in };
}

export interface GoogleCalendarListEntry {
	id: string;
	summary: string;
	backgroundColor?: string;
	primary?: boolean;
}

export async function listCalendars(accessToken: string): Promise<GoogleCalendarListEntry[]> {
	const res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
		headers: { authorization: `Bearer ${accessToken}` }
	});
	if (!res.ok) throw new Error(`calendarList failed: ${res.status}`);
	const j = await res.json();
	return (j.items ?? []).map((c: Record<string, unknown>) => ({
		id: c.id as string,
		summary: (c.summaryOverride as string) ?? (c.summary as string),
		backgroundColor: c.backgroundColor as string | undefined,
		primary: c.primary as boolean | undefined
	}));
}

export interface GoogleEvent {
	externalId: string;
	startTs: number;
	endTs: number;
	allDay: boolean;
	title: string;
	description?: string;
	location?: string;
}

/** Fetch events for a calendar within a time window (RFC3339). */
export async function listEvents(
	accessToken: string,
	calendarId: string,
	timeMin: Date,
	timeMax: Date
): Promise<GoogleEvent[]> {
	const url = new URL(
		`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
	);
	url.searchParams.set('timeMin', timeMin.toISOString());
	url.searchParams.set('timeMax', timeMax.toISOString());
	url.searchParams.set('singleEvents', 'true');
	url.searchParams.set('orderBy', 'startTime');
	url.searchParams.set('maxResults', '250');

	const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
	if (!res.ok) throw new Error(`events.list failed: ${res.status}`);
	const j = await res.json();

	return (j.items ?? [])
		.filter((e: Record<string, unknown>) => e.status !== 'cancelled')
		.map((e: Record<string, { date?: string; dateTime?: string }> & Record<string, unknown>) => {
			const allDay = !!(e.start as { date?: string }).date;
			const startStr =
				(e.start as { date?: string; dateTime?: string }).date ??
				(e.start as { dateTime?: string }).dateTime!;
			const endStr =
				(e.end as { date?: string; dateTime?: string }).date ??
				(e.end as { dateTime?: string }).dateTime!;
			return {
				externalId: e.id as string,
				startTs: Math.floor(new Date(startStr).getTime() / 1000),
				endTs: Math.floor(new Date(endStr).getTime() / 1000),
				allDay,
				title: (e.summary as string) ?? '(untitled)',
				description: e.description as string | undefined,
				location: e.location as string | undefined
			};
		});
}
