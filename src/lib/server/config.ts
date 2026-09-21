/** Load/save the non-sensitive config.json (atomic writes). Server-only. */

import fsp from 'node:fs/promises';
import { CONFIG_PATH, DATA_DIR } from './paths';
import { atomicWriteFile } from './atomicWrite';
import { PersistedConfigSchema, type PersistedConfig } from './schema';
import { setDebugEnabled } from './debugLog';

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
		const cfg = PersistedConfigSchema.parse(JSON.parse(raw));
		setDebugEnabled(cfg.app.debugLogging);
		return cfg;
	} catch {
		return defaultPersisted();
	}
}

/** Persist config.json atomically (temp file + rename). */
export async function saveConfig(config: PersistedConfig): Promise<void> {
	const validated = PersistedConfigSchema.parse(config);
	setDebugEnabled(validated.app.debugLogging);
	await fsp.mkdir(DATA_DIR, { recursive: true });
	await atomicWriteFile(CONFIG_PATH, JSON.stringify(validated, null, 2), 'utf8');
}
