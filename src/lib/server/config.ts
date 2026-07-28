/** Load/save the non-sensitive config.json (atomic writes). Server-only. */

import fsp from 'node:fs/promises';
import { CONFIG_PATH, DATA_DIR } from './paths';
import { PersistedConfigSchema, type PersistedConfig } from './schema';

/** A fresh, unconfigured config (schema defaults fill everything). */
export function defaultPersisted(): PersistedConfig {
	return PersistedConfigSchema.parse({});
}

/**
 * Read config.json. Missing or invalid file → defaults (so a corrupt/absent
 * file never crashes the appliance — it just returns to an unconfigured state).
 */
export async function loadConfig(): Promise<PersistedConfig> {
	try {
		const raw = await fsp.readFile(CONFIG_PATH, 'utf8');
		return PersistedConfigSchema.parse(JSON.parse(raw));
	} catch {
		return defaultPersisted();
	}
}

/** Persist config.json atomically (temp file + rename). */
export async function saveConfig(config: PersistedConfig): Promise<void> {
	const validated = PersistedConfigSchema.parse(config);
	await fsp.mkdir(DATA_DIR, { recursive: true });
	const tmp = `${CONFIG_PATH}.tmp`;
	await fsp.writeFile(tmp, JSON.stringify(validated, null, 2), 'utf8');
	await fsp.rename(tmp, CONFIG_PATH);
}
