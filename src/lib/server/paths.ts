import path from 'node:path';

/**
 * On-device data directory. Everything the device persists lives here and is
 * gitignored (/data). Overridable via DATA_DIR for tests/deploys.
 */
export const DATA_DIR = process.env.DATA_DIR
	? path.resolve(process.env.DATA_DIR)
	: path.resolve('data');

/** Non-sensitive settings written by the setup wizard. */
export const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
