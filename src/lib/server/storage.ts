/**
 * Data storage location: keep everything local on the Pi, or on a mounted NAS
 * folder. Reports disk space and migrates data between locations. Server-only.
 *
 * The NAS folder must already be mounted on the Pi (CIFS/NFS via fstab) — we
 * just point the data dir at it. Migration copies the current data across and
 * updates the pointer; the change takes effect on the next server restart.
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR, LOCAL_DATA_DIR, POINTER_PATH } from './paths';

export type StorageMode = 'local' | 'nas';

export interface DiskUsage {
	total: number;
	free: number;
	used: number;
}

export interface StorageInfo {
	mode: StorageMode;
	dataDir: string;
	localPath: string;
	disk: DiskUsage | null;
}

export async function diskUsage(dir: string): Promise<DiskUsage | null> {
	try {
		const s = await fsp.statfs(dir);
		const total = s.blocks * s.bsize;
		const free = s.bavail * s.bsize;
		return { total, free, used: total - free };
	} catch {
		return null;
	}
}

function readPointer(): { mode: StorageMode; path: string } {
	try {
		const j = JSON.parse(fs.readFileSync(POINTER_PATH, 'utf8')) as {
			mode?: StorageMode;
			path?: string;
		};
		return { mode: j.mode ?? 'local', path: j.path ?? DATA_DIR };
	} catch {
		return { mode: 'local', path: DATA_DIR };
	}
}

export async function storageInfo(): Promise<StorageInfo> {
	const ptr = readPointer();
	return {
		mode: ptr.mode,
		dataDir: DATA_DIR,
		localPath: LOCAL_DATA_DIR,
		disk: await diskUsage(DATA_DIR)
	};
}

/** Check a candidate NAS path: exists (or creatable) + writable + its free space. */
export async function checkPath(
	target: string
): Promise<{ ok: boolean; error?: string; disk: DiskUsage | null }> {
	const dest = path.resolve(target);
	try {
		await fsp.mkdir(dest, { recursive: true });
		await fsp.access(dest, fs.constants.W_OK);
		return { ok: true, disk: await diskUsage(dest) };
	} catch (e) {
		return { ok: false, error: e instanceof Error ? e.message : 'not writable', disk: null };
	}
}

/**
 * Migrate data to `local` (./data) or `nas` (targetPath). Copies the current
 * data dir across, then updates the pointer. Returns { restartRequired } — the
 * running process keeps using the old dir until it restarts.
 */
export async function migrateTo(
	mode: StorageMode,
	targetPath?: string
): Promise<{ ok: boolean; error?: string; restartRequired: boolean; dest: string }> {
	const dest = mode === 'local' ? LOCAL_DATA_DIR : path.resolve(targetPath ?? '');
	if (mode === 'nas' && !targetPath) {
		return { ok: false, error: 'a NAS folder path is required', restartRequired: false, dest };
	}

	const check = await checkPath(dest);
	if (!check.ok) return { ok: false, error: check.error, restartRequired: false, dest };

	// Copy current data across (skip if it's already the same directory).
	if (path.resolve(dest) !== path.resolve(DATA_DIR)) {
		try {
			await fsp.cp(DATA_DIR, dest, { recursive: true, force: true, errorOnExist: false });
		} catch (e) {
			return {
				ok: false,
				error: e instanceof Error ? e.message : 'copy failed',
				restartRequired: false,
				dest
			};
		}
	}

	await fsp.writeFile(POINTER_PATH, JSON.stringify({ mode, path: dest }, null, 2), 'utf8');
	return { ok: true, restartRequired: true, dest };
}
