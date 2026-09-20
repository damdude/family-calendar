import { error, json } from '@sveltejs/kit';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { defaultPersisted, saveConfig } from '$lib/server/config';
import { emptyData, saveFamilyData } from '$lib/server/familydata';
import { getDb } from '$lib/server/db';
import { DATA_DIR } from '$lib/server/paths';
import type { RequestHandler } from './$types';

/**
 * Factory reset: return the device to its unconfigured, just-flashed state so
 * the setup wizard runs again. Destructive and irreversible.
 *
 * Deliberately left alone: update-state.json (OTA bookkeeping, not family
 * data) and the schema_migrations table, so the DB isn't re-migrated from
 * scratch on the next open.
 */
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => null);
	if (body?.confirm !== 'FACTORY_RESET_CONFIRM') {
		throw error(400, 'Factory reset requires confirmation');
	}

	try {
		// Synced calendar data lives in SQLite. Order matters: event_overrides
		// and events reference calendars.
		const db = getDb();
		db.exec(`
			DELETE FROM event_overrides;
			DELETE FROM events;
			DELETE FROM calendars;
			DELETE FROM oauth_tokens;
		`);

		// Meals, lists, tasks, recipes, chores, stars and rewards are all in
		// family-data.json, not the database.
		await saveFamilyData(emptyData());

		// Sites of Interest and photos are their own files; the encrypted
		// photo blobs go with the index that references them.
		for (const f of ['sites.json', 'photos.json']) {
			await fsp.rm(path.join(DATA_DIR, f), { force: true });
		}
		await fsp.rm(path.join(DATA_DIR, 'uploads'), { recursive: true, force: true });

		// Schema defaults = the unconfigured state, which sends the app back
		// to /setup on the next load.
		await saveConfig(defaultPersisted());

		return json({ ok: true, message: 'Factory reset complete.' });
	} catch (err) {
		console.error('Factory reset failed:', err);
		throw error(500, 'Factory reset failed');
	}
};
