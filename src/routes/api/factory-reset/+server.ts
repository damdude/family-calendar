import { error, json } from '@sveltejs/kit';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { defaultPersisted, saveConfig } from '$lib/server/config';
import { emptyData, saveFamilyData } from '$lib/server/familydata';
import { getDb } from '$lib/server/db';
import { DATA_DIR, POINTER_PATH } from '$lib/server/paths';
import { setEnvLine } from '$lib/server/envFile';
import type { RequestHandler } from './$types';

const ENV_PATH = path.resolve('.env');

/** Detach so the work survives this request's lifetime — the network teardown
 *  below deliberately cuts the connection the caller is using. */
function detached(cmd: string, args: string[]) {
	try {
		const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
		child.on('error', () => {
			/* not a systemd/Pi host (dev machine) */
		});
		child.unref();
	} catch {
		/* ignore */
	}
}

/**
 * Factory reset: return the device to its just-flashed state.
 *
 * "Just-flashed" has to include things that are not app data, which an
 * earlier version of this missed — most visibly the Wi-Fi credentials, which
 * live in NetworkManager rather than under DATA_DIR, so the device cheerfully
 * rejoined the family's network after being "reset to factory".
 *
 * Order matters. Everything local is wiped first, the response is sent, and
 * only then does the network go away and the device reboot — otherwise the
 * caller's connection dies mid-request and they never learn whether it
 * worked.
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
		// DELETE leaves the freed pages in the write-ahead log, so without this
		// the family's events are still sitting in family.db-wal afterwards.
		db.pragma('wal_checkpoint(TRUNCATE)');
		db.exec('VACUUM');

		// Meals, lists, tasks, recipes, chores, stars and rewards are all in
		// family-data.json, not the database.
		await saveFamilyData(emptyData());

		// Per-file state: Sites of Interest, the photo index and its encrypted
		// blobs, the parental PIN, and the at-rest key. The key is regenerated
		// on next use, which is correct here because everything it ever
		// encrypted has just been deleted.
		for (const f of ['sites.json', 'photos.json', 'admin.json', 'device-secret']) {
			await fsp.rm(path.join(DATA_DIR, f), { force: true });
		}
		await fsp.rm(path.join(DATA_DIR, 'uploads'), { recursive: true, force: true });

		// Storage pointer: a device sent back to factory should look for its
		// data locally again, not on whatever NAS this family used.
		await fsp.rm(POINTER_PATH, { force: true });

		// The Google OAuth client belongs to the household that set it up.
		try {
			let env = await fsp.readFile(ENV_PATH, 'utf8');
			env = setEnvLine(env, 'GOOGLE_OAUTH_CLIENT_ID', '');
			env = setEnvLine(env, 'GOOGLE_OAUTH_CLIENT_SECRET', '');
			await fsp.writeFile(ENV_PATH, env, { mode: 0o600 });
			delete process.env.GOOGLE_OAUTH_CLIENT_ID;
			delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
		} catch {
			/* no .env on a dev box — nothing to clear */
		}

		// Schema defaults = the unconfigured state, which sends the app back
		// to /setup on the next load.
		await saveConfig(defaultPersisted());
	} catch (err) {
		console.error('Factory reset failed:', err);
		throw error(500, 'Factory reset failed');
	}

	// Past the point of no return: hand the caller a result, then drop the
	// network and reboot so the device comes up in first-boot onboarding
	// exactly as a freshly flashed card would.
	setTimeout(() => {
		detached('sudo', ['/usr/local/bin/fc-factory-reset-net']);
		setTimeout(() => detached('sudo', ['systemctl', 'reboot']), 3000);
	}, 1500);

	return json({
		ok: true,
		message: 'Factory reset complete. The device will forget its Wi-Fi and restart.',
		rebooting: true
	});
};
