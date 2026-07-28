/**
 * SQLite connection (better-sqlite3), server-only. Single lazy connection with
 * WAL mode; migrations run once on first open.
 */

import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from '../paths';
import { migrations } from './migrations';

const DB_PATH = path.join(DATA_DIR, 'family.db');

let db: Database.Database | null = null;

/** Whether the DB file exists yet (avoid creating it just to read). */
export function dbExists(): boolean {
	return db !== null || fs.existsSync(DB_PATH);
}

function runMigrations(conn: Database.Database) {
	conn.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
		version INTEGER PRIMARY KEY,
		name TEXT NOT NULL,
		applied_at INTEGER NOT NULL
	)`);
	const current =
		(
			conn.prepare('SELECT MAX(version) AS v FROM schema_migrations').get() as {
				v: number | null;
			}
		).v ?? 0;

	const pending = migrations
		.filter((m) => m.version > current)
		.sort((a, b) => a.version - b.version);
	for (const m of pending) {
		const tx = conn.transaction(() => {
			conn.exec(m.sql);
			conn
				.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
				.run(m.version, m.name, Date.now());
		});
		tx();
	}
}

export function getDb(): Database.Database {
	if (!db) {
		fs.mkdirSync(DATA_DIR, { recursive: true });
		db = new Database(DB_PATH);
		db.pragma('journal_mode = WAL');
		db.pragma('foreign_keys = ON');
		runMigrations(db);
	}
	return db;
}
