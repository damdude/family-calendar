/**
 * Atomic file write: write-to-temp + rename, so a crash or concurrent read
 * never sees a half-written file. Server-only.
 *
 * The temp filename is unique per call (pid + random suffix) rather than a
 * fixed `<path>.tmp` — two writers racing on the same fixed tmp path can
 * ENOENT on rename (one writer's tmp file gets consumed by the other's
 * rename before the first gets to its own). Confirmed on-device: rapid
 * routine-step taps from the phone companion fire several concurrent saves
 * to the same progress.json, and every one past the first failed this way.
 */
import fsp from 'node:fs/promises';
import path from 'node:path';

export async function atomicWriteFile(
	filePath: string,
	data: string | Uint8Array,
	options?: Parameters<typeof fsp.writeFile>[2]
): Promise<void> {
	const tmp = path.join(
		path.dirname(filePath),
		`.${path.basename(filePath)}.tmp.${process.pid}.${Math.random().toString(36).slice(2)}`
	);
	await fsp.writeFile(tmp, data, options);
	await fsp.rename(tmp, filePath);
}
