/** Typed data access over the SQLite connection. Server-only. */

import { getDb, dbExists } from './index';
import { encryptString, decryptString, encrypt, decrypt } from '../crypto';

// --- OAuth tokens (encrypted at rest) ---

export interface StoredToken {
	provider: string;
	accountEmail?: string;
	refreshToken: string;
	accessToken?: string;
	accessExpiresAt?: number;
	scope?: string;
}

export function saveOAuthToken(t: StoredToken): void {
	const db = getDb();
	const now = Math.floor(Date.now() / 1000);
	db.prepare(
		`INSERT INTO oauth_tokens
			(provider, account_email, refresh_token_encrypted, access_token_encrypted, access_expires_at, scope, created_at, updated_at)
		 VALUES (@provider, @email, @refresh, @access, @exp, @scope, @now, @now)
		 ON CONFLICT(provider) DO UPDATE SET
			account_email=@email, refresh_token_encrypted=@refresh,
			access_token_encrypted=@access, access_expires_at=@exp, scope=@scope, updated_at=@now`
	).run({
		provider: t.provider,
		email: t.accountEmail ?? null,
		refresh: encryptString(t.refreshToken),
		access: t.accessToken ? encryptString(t.accessToken) : null,
		exp: t.accessExpiresAt ?? null,
		scope: t.scope ?? null,
		now
	});
}

export function getOAuthToken(provider: string): StoredToken | null {
	const row = getDb().prepare('SELECT * FROM oauth_tokens WHERE provider = ?').get(provider) as
		| {
				provider: string;
				account_email: string | null;
				refresh_token_encrypted: Buffer;
				access_token_encrypted: Buffer | null;
				access_expires_at: number | null;
				scope: string | null;
		  }
		| undefined;
	if (!row) return null;
	return {
		provider: row.provider,
		accountEmail: row.account_email ?? undefined,
		refreshToken: decryptString(row.refresh_token_encrypted),
		accessToken: row.access_token_encrypted ? decryptString(row.access_token_encrypted) : undefined,
		accessExpiresAt: row.access_expires_at ?? undefined,
		scope: row.scope ?? undefined
	};
}

export function deleteOAuthToken(provider: string): void {
	getDb().prepare('DELETE FROM oauth_tokens WHERE provider = ?').run(provider);
}

// --- Calendars + events ---

export function upsertCalendar(c: {
	provider: string;
	externalId: string;
	name?: string;
	colorHex?: string;
	profileId?: number;
	isBirthdays?: boolean;
}): number {
	const db = getDb();
	db.prepare(
		`INSERT INTO calendars (provider, external_id, name, color_hex, profile_id, is_birthdays, enabled)
		 VALUES (@provider, @externalId, @name, @colorHex, @profileId, @isBirthdays, 1)
		 ON CONFLICT(provider, external_id) DO UPDATE SET name=@name, color_hex=@colorHex`
	).run({
		provider: c.provider,
		externalId: c.externalId,
		name: c.name ?? null,
		colorHex: c.colorHex ?? null,
		profileId: c.profileId ?? null,
		isBirthdays: c.isBirthdays ? 1 : 0
	});
	return (
		db
			.prepare('SELECT id FROM calendars WHERE provider = ? AND external_id = ?')
			.get(c.provider, c.externalId) as { id: number }
	).id;
}

export interface CalendarRow {
	id: number;
	provider: string;
	externalId: string;
	name: string | null;
	colorHex: string | null;
	profileId: number | null;
	lastSync: number | null;
	isBirthdays: boolean;
}

/** All calendars, optionally filtered by provider (e.g. 'ical'). */
export function getCalendars(provider?: string): CalendarRow[] {
	const db = getDb();
	const rows = (
		provider
			? db.prepare('SELECT * FROM calendars WHERE provider = ? ORDER BY id').all(provider)
			: db.prepare('SELECT * FROM calendars ORDER BY id').all()
	) as Array<{
		id: number;
		provider: string;
		external_id: string;
		name: string | null;
		color_hex: string | null;
		profile_id: number | null;
		last_sync: number | null;
		is_birthdays: number;
	}>;
	return rows.map((r) => ({
		id: r.id,
		provider: r.provider,
		externalId: r.external_id,
		name: r.name,
		colorHex: r.color_hex,
		profileId: r.profile_id,
		lastSync: r.last_sync,
		isBirthdays: !!r.is_birthdays
	}));
}

export function setCalendarSynced(id: number): void {
	getDb()
		.prepare('UPDATE calendars SET last_sync = ? WHERE id = ?')
		.run(Math.floor(Date.now() / 1000), id);
}

/** Mark (or unmark) a calendar as the birthdays feed — its events populate
 *  the Vestaboard's upcoming-birthdays board instead of the generic one. */
export function setCalendarBirthdays(id: number, flag: boolean): void {
	getDb()
		.prepare('UPDATE calendars SET is_birthdays = ? WHERE id = ?')
		.run(flag ? 1 : 0, id);
}

/** Events from any calendar(s) flagged as a birthdays feed, within the next
 *  `days` days (today included) — for the Vestaboard's upcoming-birthdays
 *  board. Birthday calendars are typically yearly all-day events, already
 *  recurrence-expanded by the normal ICS sync within its own window, so this
 *  just filters what's already stored rather than fetching anything extra. */
export function getUpcomingBirthdays(days: number): Array<{ title: string; startTs: number }> {
	if (!dbExists()) return [];
	const now = Math.floor(Date.now() / 1000);
	const rows = getDb()
		.prepare(
			`SELECT e.title, e.start_ts FROM events e JOIN calendars c ON c.id = e.calendar_id
			 WHERE c.is_birthdays = 1 AND c.enabled = 1 AND e.start_ts >= ? AND e.start_ts < ?
			 ORDER BY e.start_ts`
		)
		.all(now - 86_400, now + days * 86_400) as Array<{ title: string | null; start_ts: number }>;
	return rows.map((r) => ({ title: r.title ?? '(untitled)', startTs: r.start_ts }));
}

export function removeCalendar(id: number): void {
	// Events cascade via the FK.
	getDb().prepare('DELETE FROM events WHERE calendar_id = ?').run(id);
	getDb().prepare('DELETE FROM calendars WHERE id = ?').run(id);
}

/** Drop all events for a calendar (used before a full ICS re-sync). */
export function clearCalendarEvents(calendarId: number): void {
	getDb().prepare('DELETE FROM events WHERE calendar_id = ?').run(calendarId);
}

export interface SyncedEvent {
	calendarId: number;
	externalId: string;
	startTs: number;
	endTs: number;
	allDay: boolean;
	title?: string;
	description?: string;
	location?: string;
	/** The sync step's own best guess at who this belongs to (attendee-email
	 *  match, dedup resolution, or the calendar's default — see sync.ts) —
	 *  a phone-side manual reassignment lives in event_overrides instead,
	 *  unaffected by every raw events row being deleted and re-inserted on
	 *  each ICS sync (clearCalendarEvents + this function). Empty means
	 *  "the whole family", the same convention used everywhere else. */
	profileIds?: number[];
}

export function upsertEvent(e: SyncedEvent): void {
	getDb()
		.prepare(
			`INSERT INTO events
				(calendar_id, external_id, start_ts, end_ts, all_day, title, description_encrypted, location, profile_ids_json, updated_at)
			 VALUES (@calendarId, @externalId, @startTs, @endTs, @allDay, @title, @desc, @location, @profileIdsJson, @now)
			 ON CONFLICT(calendar_id, external_id) DO UPDATE SET
				start_ts=@startTs, end_ts=@endTs, all_day=@allDay, title=@title,
				description_encrypted=@desc, location=@location, profile_ids_json=@profileIdsJson, updated_at=@now`
		)
		.run({
			calendarId: e.calendarId,
			externalId: e.externalId,
			startTs: e.startTs,
			endTs: e.endTs,
			allDay: e.allDay ? 1 : 0,
			title: e.title ?? null,
			desc: e.description ? encryptString(e.description) : null,
			location: e.location ?? null,
			profileIdsJson: JSON.stringify(e.profileIds ?? []),
			now: Math.floor(Date.now() / 1000)
		});
}

/** (calendar_id, external_id) for a synced event's current numeric row id —
 *  event_overrides is keyed by the former (stable across syncs), but the
 *  phone only ever has the latter (it's what's in the merged event list),
 *  so every override write looks this up first. */
export function getEventCalendarExternalId(
	id: number
): { calendarId: number; externalId: string } | null {
	const row = getDb().prepare('SELECT calendar_id, external_id FROM events WHERE id = ?').get(id) as
		| { calendar_id: number; external_id: string }
		| undefined;
	return row ? { calendarId: row.calendar_id, externalId: row.external_id } : null;
}

export interface EventOverrideInput {
	startTs: number;
	endTs: number;
	allDay: boolean;
	location?: string;
	profileIds: number[];
}

/** Set (or replace) the local override for a synced event — time, location,
 *  and who it's assigned to, all together, since the phone's edit form
 *  submits the whole event at once. Survives every future sync (a separate
 *  table, never touched by clearCalendarEvents). */
export function setEventOverride(calendarId: number, externalId: string, e: EventOverrideInput): void {
	getDb()
		.prepare(
			`INSERT INTO event_overrides (calendar_id, external_id, start_ts, end_ts, all_day, location, profile_ids_json, updated_at)
			 VALUES (@calendarId, @externalId, @startTs, @endTs, @allDay, @location, @profileIdsJson, @now)
			 ON CONFLICT(calendar_id, external_id) DO UPDATE SET
				start_ts=@startTs, end_ts=@endTs, all_day=@allDay, location=@location,
				profile_ids_json=@profileIdsJson, updated_at=@now`
		)
		.run({
			calendarId,
			externalId,
			startTs: e.startTs,
			endTs: e.endTs,
			allDay: e.allDay ? 1 : 0,
			location: e.location ?? null,
			profileIdsJson: JSON.stringify(e.profileIds),
			now: Math.floor(Date.now() / 1000)
		});
}

/** Drop a synced event's local override entirely — reverts to whatever the
 *  source calendar itself says (time/location) and the sync step's own
 *  profile guess. */
export function clearEventOverride(calendarId: number, externalId: string): void {
	getDb()
		.prepare('DELETE FROM event_overrides WHERE calendar_id = ? AND external_id = ?')
		.run(calendarId, externalId);
}

export interface EventRow {
	id: number;
	calendarId: number;
	profileIds: number[];
	startTs: number;
	endTs: number;
	allDay: boolean;
	title: string;
	location?: string;
	description?: string;
	/** True when a phone edit is currently pinning this event's time/
	 *  location/assignment instead of the source calendar's own values. */
	overridden: boolean;
}

const EVENT_SELECT = `
	e.id, e.calendar_id, e.title, e.description_encrypted,
	COALESCE(o.start_ts, e.start_ts) AS start_ts,
	COALESCE(o.end_ts, e.end_ts) AS end_ts,
	COALESCE(o.all_day, e.all_day) AS all_day,
	COALESCE(o.location, e.location) AS location,
	COALESCE(o.profile_ids_json, '[]') AS override_profile_ids_json,
	e.profile_ids_json AS auto_profile_ids_json,
	c.profile_id AS calendar_profile_id,
	(o.calendar_id IS NOT NULL) AS overridden
	FROM events e
	JOIN calendars c ON c.id = e.calendar_id
	LEFT JOIN event_overrides o ON o.calendar_id = e.calendar_id AND o.external_id = e.external_id
`;

/** Who an event is for, layering three sources — a phone-side manual
 *  override, then the sync step's own attendee-matched guess, then
 *  (pre-migration rows only) the calendar's single default profile.
 *  An override or auto-guess of `[]` is only trusted as a deliberate
 *  "the whole family" once it's actually present — parsed as a non-empty
 *  *array literal in the JSON*, not merely an empty result — so a genuinely
 *  absent override (the common case) correctly falls through to the next
 *  source instead of being misread as "no one, on purpose". By the time any
 *  of this is read, `auto_profile_ids_json` is always sync.ts's fully
 *  resolved answer (it already folds the calendar default in), so that
 *  final fallback only ever matters for a row untouched since before this
 *  column existed. */
function resolveProfileIds(
	overrideJson: string,
	autoJson: string,
	calendarProfileId: number | null
): number[] {
	// A phone edit's own empty profileIds means "nothing pinned, defer" (see
	// EventOverrideInput) — a real override always has at least one id, so
	// only a *non-empty* parsed array counts as one actually being present.
	const override = tryParseIdArray(overrideJson);
	if (override && override.length) return override;
	// The auto-guess is different: sync.ts writes [] on purpose for a
	// shared/household address match, and that's a real answer, not an
	// absence of one — every value tryParseIdArray hands back here (empty
	// or not) is trusted as-is.
	const auto = tryParseIdArray(autoJson);
	if (auto) return auto;
	return calendarProfileId !== null ? [calendarProfileId] : [];
}

/** Parses a JSON array-of-numbers column, returning null (not []) when the
 *  column holds no real array at all — malformed, or the schema default
 *  before any write has ever happened — so callers can tell "nothing here"
 *  apart from a deliberately empty (household) assignment. */
function tryParseIdArray(json: string): number[] | null {
	try {
		const parsed = JSON.parse(json);
		return Array.isArray(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

/** Events overlapping [from, to] (unix seconds), with local overrides
 *  (time/location/assignment) already applied. */
export function getEventsInRange(from: number, to: number): EventRow[] {
	const rows = getDb()
		.prepare(
			`SELECT ${EVENT_SELECT} WHERE c.enabled = 1 AND COALESCE(o.start_ts, e.start_ts) < ? AND COALESCE(o.end_ts, e.end_ts) > ? ORDER BY start_ts`
		)
		.all(to, from) as Array<{
		id: number;
		calendar_id: number;
		start_ts: number;
		end_ts: number;
		all_day: number;
		title: string | null;
		location: string | null;
		description_encrypted: Buffer | null;
		override_profile_ids_json: string;
		auto_profile_ids_json: string;
		calendar_profile_id: number | null;
		overridden: number;
	}>;
	return rows.map((r) => ({
		id: r.id,
		calendarId: r.calendar_id,
		profileIds: resolveProfileIds(
			r.override_profile_ids_json,
			r.auto_profile_ids_json,
			r.calendar_profile_id
		),
		startTs: r.start_ts,
		endTs: r.end_ts,
		allDay: !!r.all_day,
		title: r.title ?? '(untitled)',
		location: r.location ?? undefined,
		description: r.description_encrypted ? decryptString(r.description_encrypted) : undefined,
		overridden: !!r.overridden
	}));
}

/** Lean synced events for display (no decrypted description). Returns [] when
 *  the DB file doesn't exist yet, so page loads never create it. */
export function getSyncedEventsLean(
	from: number,
	to: number
): Array<{
	id: number;
	profileIds: number[];
	startTs: number;
	endTs: number;
	allDay: boolean;
	title: string;
	location?: string;
	overridden: boolean;
}> {
	if (!dbExists()) return [];
	const rows = getDb()
		.prepare(
			`SELECT ${EVENT_SELECT} WHERE c.enabled = 1 AND COALESCE(o.start_ts, e.start_ts) < ? AND COALESCE(o.end_ts, e.end_ts) > ? ORDER BY start_ts`
		)
		.all(to, from) as Array<{
		id: number;
		start_ts: number;
		end_ts: number;
		all_day: number;
		title: string | null;
		location: string | null;
		override_profile_ids_json: string;
		auto_profile_ids_json: string;
		calendar_profile_id: number | null;
		overridden: number;
	}>;
	return rows.map((r) => ({
		id: r.id,
		profileIds: resolveProfileIds(
			r.override_profile_ids_json,
			r.auto_profile_ids_json,
			r.calendar_profile_id
		),
		startTs: r.start_ts,
		endTs: r.end_ts,
		allDay: !!r.all_day,
		title: r.title ?? '(untitled)',
		location: r.location ?? undefined,
		overridden: !!r.overridden
	}));
}

// Re-export blob helpers for callers that need them.
export { encrypt, decrypt };
