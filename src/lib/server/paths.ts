import fs from 'node:fs';
import path from 'node:path';

/**
 * Where the device persists everything (config, DB, photos, secrets).
 *
 * Resolution order:
 *   1. DATA_DIR env var (explicit override).
 *   2. The pointer file `.data-location` in the app root — a small JSON
 *      `{ "mode": "local"|"nas", "path": "…" }` written when the user chooses
 *      local-vs-NAS storage. This lets data live on a mounted NAS folder.
 *   3. `./data` (local default).
 *
 * The pointer lives OUTSIDE the movable data dir (in the app root) so it's found
 * before we know where the data is. DATA_DIR is resolved once at startup, so a
 * storage migration takes effect on the next restart.
 */
export const POINTER_PATH = path.resolve('.data-location');
export const LOCAL_DATA_DIR = path.resolve('data');

function resolveDataDir(): string {
	if (process.env.DATA_DIR) return path.resolve(process.env.DATA_DIR);
	try {
		const raw = fs.readFileSync(POINTER_PATH, 'utf8').trim();
		if (raw) {
			const j = JSON.parse(raw) as { path?: string };
			if (j.path) return path.resolve(j.path);
		}
	} catch {
		/* no pointer → local default */
	}
	return LOCAL_DATA_DIR;
}

export const DATA_DIR = resolveDataDir();

/** Non-sensitive settings written by the setup wizard. */
export const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
