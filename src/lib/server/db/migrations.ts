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
	}
];
