/**
 * Versioned schema migrations, applied in order and tracked in
 * `schema_migrations`. Never edit a shipped migration — add a new one.
 *
 * Sensitive columns end in `_encrypted` and hold AES-256-GCM blobs
 * (see src/lib/server/crypto.ts). Non-sensitive family settings stay in
 * config.json; SQLite owns the relational calendar data + secrets.
 */

export interface Migration {
	version: number;
	name: string;
	sql: string;
}

export const migrations: Migration[] = [
	{
		version: 1,
		name: 'calendar_core',
		sql: `
			CREATE TABLE oauth_tokens (
				provider TEXT PRIMARY KEY,          -- 'google' | 'outlook' | ...
				account_email TEXT,
				refresh_token_encrypted BLOB NOT NULL,
				access_token_encrypted BLOB,
				access_expires_at INTEGER,          -- unix seconds
				scope TEXT,
				created_at INTEGER NOT NULL,
				updated_at INTEGER NOT NULL
			);

			CREATE TABLE calendars (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				provider TEXT NOT NULL,
				external_id TEXT NOT NULL,          -- provider calendar id
				profile_id INTEGER,                 -- optional owner (config.json profile)
				name TEXT,
				color_hex TEXT,
				sync_token TEXT,                    -- provider incremental sync cursor
				last_sync INTEGER,
				enabled INTEGER NOT NULL DEFAULT 1,
				UNIQUE (provider, external_id)
			);

			CREATE TABLE events (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				calendar_id INTEGER NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
				external_id TEXT NOT NULL,
				start_ts INTEGER NOT NULL,          -- unix seconds
				end_ts INTEGER NOT NULL,
				all_day INTEGER NOT NULL DEFAULT 0,
				title TEXT,
				description_encrypted BLOB,         -- sensitive
				location TEXT,
				updated_at INTEGER NOT NULL,
				UNIQUE (calendar_id, external_id)
			);

			CREATE INDEX idx_events_time ON events (start_ts, end_ts);
		`
	},
	{
		version: 2,
		name: 'event_profile_override',
		sql: `
			-- Overrides the owning calendar's profile_id for one event. Set when
			-- the same real-world event is synced onto more than one family
			-- member's calendar (e.g. a parent invited a child) — the sync step
			-- keeps a single row and tags it with whichever family member it's
			-- actually for, instead of leaving it attributed to whoever's
			-- calendar happened to be picked for storage.
			ALTER TABLE events ADD COLUMN profile_id INTEGER;
		`
	},
	{
		version: 3,
		name: 'event_profile_overridden_flag',
		sql: `
			-- Distinguishes a MANUAL profile reassignment (phone companion) from
			-- profile_id merely holding the sync step's own dedup guess — without
			-- this flag, upsertEvent had no way to tell the two apart, so the
			-- next sync (every 15 min) always overwrote a manual reassignment
			-- with its own guess. Once set, upsertEvent leaves profile_id alone
			-- until explicitly cleared.
			ALTER TABLE events ADD COLUMN profile_overridden INTEGER NOT NULL DEFAULT 0;
		`
	},
	{
		version: 4,
		name: 'calendar_birthdays_flag',
		sql: `
			-- Marks a subscribed calendar as a birthdays feed (e.g. Google's
			-- auto-generated "Birthdays" calendar, or any other ICS export of
			-- yearly birthday events) — its events feed the Vestaboard's
			-- upcoming-birthdays board instead of the generic events board.
			ALTER TABLE calendars ADD COLUMN is_birthdays INTEGER NOT NULL DEFAULT 0;
		`
	},
	{
		version: 5,
		name: 'event_overrides',
		sql: `
			-- Local edits to a synced event (phone companion): who it's assigned
			-- to, and now also its time/location — kept in their own table,
			-- keyed by (calendar_id, external_id) rather than living on the
			-- events row itself. events rows get fully deleted and re-inserted
			-- on every ICS sync (clearCalendarEvents + upsertEvent), so an
			-- override stored there could only be matched back up by title+time
			-- (see the now-removed getOverriddenProfilesByDedupKey) — which
			-- breaks the moment the override itself changes the start/end time,
			-- since that's exactly what the next sync would use to look it up.
			-- (calendar_id, external_id) is what actually stays stable for the
			-- same real-world event across every re-sync, for both ICS (the
			-- feed's own UID) and Google (the event id) — so a LEFT JOIN here at
			-- read time survives edits to any of these fields, including time.
			CREATE TABLE event_overrides (
				calendar_id INTEGER NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
				external_id TEXT NOT NULL,
				start_ts INTEGER NOT NULL,
				end_ts INTEGER NOT NULL,
				all_day INTEGER NOT NULL,
				location TEXT,
				profile_ids_json TEXT NOT NULL DEFAULT '[]',
				updated_at INTEGER NOT NULL,
				PRIMARY KEY (calendar_id, external_id)
			);
		`
	}
];
