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
	/** Overrides the owning calendar's profile_id — set when this event was
	 *  deduped from a copy synced onto more than one family member's
	 *  calendar, tagging it with whichever one it's actually for. */
	profileId?: number;
	/** True when `profileId` came from a manual phone reassignment rather
	 *  than the sync step's own dedup guess — see setEventProfileOverride. */
	profileOverridden?: boolean;
}

/** True (default) leaves an existing manual override alone on conflict — set
 *  false only from the code path that's re-applying a snapshotted override
 *  across a full calendar rebuild (syncIcal), where there's no existing row
 *  to preserve. */
export function upsertEvent(e: SyncedEvent): void {
	getDb()
		.prepare(
			`INSERT INTO events
				(calendar_id, external_id, start_ts, end_ts, all_day, title, description_encrypted, location, profile_id, profile_overridden, updated_at)
			 VALUES (@calendarId, @externalId, @startTs, @endTs, @allDay, @title, @desc, @location, @profileId, @profileOverridden, @now)
			 ON CONFLICT(calendar_id, external_id) DO UPDATE SET
				start_ts=@startTs, end_ts=@endTs, all_day=@allDay, title=@title,
				description_encrypted=@desc, location=@location, updated_at=@now,
				profile_id = CASE WHEN events.profile_overridden = 1 THEN events.profile_id ELSE @profileId END,
				profile_overridden = MAX(events.profile_overridden, @profileOverridden)`
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
			profileId: e.profileId ?? null,
			profileOverridden: e.profileOverridden ? 1 : 0,
			now: Math.floor(Date.now() / 1000)
		});
}

/** Manually override which profile a synced event belongs to (phone
 *  companion) — survives the next sync (see upsertEvent). `null` clears the
 *  override back to the sync step's own guess / the calendar's default.
 *  Returns false if no such event. */
export function setEventProfileOverride(id: number, profileId: number | null): boolean {
	const info = getDb()
		.prepare('UPDATE events SET profile_id = ?, profile_overridden = ? WHERE id = ?')
		.run(profileId, profileId === null ? 0 : 1, id);
	return info.changes > 0;
}

/** Snapshot of manually-overridden events among the given calendars, keyed by
 *  `title|startTs|endTs` (the same dedup key sync.ts groups fetched events
 *  by) so a full ICS-calendar rebuild (clear + re-insert) can reapply them —
 *  the row's own id doesn't survive that rebuild, but this key does as long
 *  as the title/time didn't change. */
export function getOverriddenProfilesByDedupKey(calendarIds: number[]): Map<string, number> {
	const out = new Map<string, number>();
	if (calendarIds.length === 0) return out;
	const placeholders = calendarIds.map(() => '?').join(',');
	const rows = getDb()
		.prepare(
			`SELECT title, start_ts, end_ts, profile_id FROM events
			 WHERE calendar_id IN (${placeholders}) AND profile_overridden = 1 AND profile_id IS NOT NULL`
		)
		.all(...calendarIds) as Array<{
		title: string | null;
		start_ts: number;
		end_ts: number;
		profile_id: number;
	}>;
	for (const r of rows) {
		out.set(`${(r.title ?? '').trim().toLowerCase()}|${r.start_ts}|${r.end_ts}`, r.profile_id);
	}
	return out;
}

export interface EventRow {
	id: number;
	calendarId: number;
	profileId?: number;
	startTs: number;
	endTs: number;
	allDay: boolean;
	title: string;
	location?: string;
	description?: string;
}

/** Events overlapping [from, to] (unix seconds), with owning profile if any. */
export function getEventsInRange(from: number, to: number): EventRow[] {
	const rows = getDb()
		.prepare(
			`SELECT e.*, COALESCE(e.profile_id, c.profile_id) AS profile_id
			 FROM events e JOIN calendars c ON c.id = e.calendar_id
			 WHERE c.enabled = 1 AND e.start_ts < ? AND e.end_ts > ?
			 ORDER BY e.start_ts`
		)
		.all(to, from) as Array<{
		id: number;
		calendar_id: number;
		profile_id: number | null;
		start_ts: number;
		end_ts: number;
		all_day: number;
		title: string | null;
		location: string | null;
		description_encrypted: Buffer | null;
	}>;
	return rows.map((r) => ({
		id: r.id,
		calendarId: r.calendar_id,
		profileId: r.profile_id ?? undefined,
		startTs: r.start_ts,
		endTs: r.end_ts,
		allDay: !!r.all_day,
		title: r.title ?? '(untitled)',
		location: r.location ?? undefined,
		description: r.description_encrypted ? decryptString(r.description_encrypted) : undefined
	}));
}

/** Lean synced events for display (no decrypted description). Returns [] when
 *  the DB file doesn't exist yet, so page loads never create it. */
export function getSyncedEventsLean(
	from: number,
	to: number
): Array<{
	id: number;
	profileId?: number;
	startTs: number;
	endTs: number;
	allDay: boolean;
	title: string;
	location?: string;
}> {
	if (!dbExists()) return [];
	const rows = getDb()
		.prepare(
			`SELECT e.id, COALESCE(e.profile_id, c.profile_id) AS profile_id, e.start_ts, e.end_ts, e.all_day, e.title, e.location
			 FROM events e JOIN calendars c ON c.id = e.calendar_id
			 WHERE c.enabled = 1 AND e.start_ts < ? AND e.end_ts > ?
			 ORDER BY e.start_ts`
		)
		.all(to, from) as Array<{
		id: number;
		profile_id: number | null;
		start_ts: number;
		end_ts: number;
		all_day: number;
		title: string | null;
		location: string | null;
	}>;
	return rows.map((r) => ({
		id: r.id,
		profileId: r.profile_id ?? undefined,
		startTs: r.start_ts,
		endTs: r.end_ts,
		allDay: !!r.all_day,
		title: r.title ?? '(untitled)',
		location: r.location ?? undefined
	}));
}

// Re-export blob helpers for callers that need them.
export { encrypt, decrypt };
