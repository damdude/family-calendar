/**
 * Encrypted family photo album, server-only. Separate from per-profile
 * avatars (media.ts) — this is the "Photos" tab's shared album, used for
 * browsing and as an additional source for the photo screensaver.
 * Each photo: data/uploads/photo-<id>.enc (same container format as
 * avatars) plus an entry in data/photos.json for ordering/metadata.
 */

import fsp from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR } from './paths';
import { atomicWriteFile } from './atomicWrite';
import { encrypt, decrypt } from './crypto';

const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const INDEX_PATH = path.join(DATA_DIR, 'photos.json');

export interface PhotoMeta {
	id: number;
	uploadedAt: number;
}

function photoFile(id: number): string {
	return path.join(UPLOAD_DIR, `photo-${id}.enc`);
}

async function loadIndex(): Promise<PhotoMeta[]> {
	try {
		const raw = JSON.parse(await fsp.readFile(INDEX_PATH, 'utf8'));
		return Array.isArray(raw) ? raw : [];
	} catch {
		return [];
	}
}

async function saveIndex(list: PhotoMeta[]): Promise<void> {
	await fsp.mkdir(DATA_DIR, { recursive: true });
	await atomicWriteFile(INDEX_PATH, JSON.stringify(list, null, 2), 'utf8');
}

/** Newest first, for browsing. */
export async function listPhotos(): Promise<PhotoMeta[]> {
	return (await loadIndex()).sort((a, b) => b.uploadedAt - a.uploadedAt);
}

export async function savePhoto(mime: string, bytes: Buffer): Promise<PhotoMeta> {
	const list = await loadIndex();
	const id = list.reduce((m, p) => Math.max(m, p.id), 0) + 1;
	const mimeBuf = Buffer.from(mime, 'utf8').subarray(0, 255);
	const container = Buffer.concat([Buffer.from([mimeBuf.length]), mimeBuf, bytes]);
	const enc = encrypt(container);
	await fsp.mkdir(UPLOAD_DIR, { recursive: true });
	await atomicWriteFile(photoFile(id), enc);
	const meta: PhotoMeta = { id, uploadedAt: Date.now() };
	list.push(meta);
	await saveIndex(list);
	return meta;
}

export async function readPhoto(id: number): Promise<{ mime: string; bytes: Buffer } | null> {
	try {
		const container = decrypt(await fsp.readFile(photoFile(id)));
		const mimeLen = container[0];
		const mime = container.subarray(1, 1 + mimeLen).toString('utf8');
		const bytes = container.subarray(1 + mimeLen);
		return { mime, bytes };
	} catch {
		return null;
	}
}

/** Returns false if no such photo. */
export async function removePhoto(id: number): Promise<boolean> {
	const list = await loadIndex();
	const i = list.findIndex((p) => p.id === id);
	if (i < 0) return false;
	list.splice(i, 1);
	await saveIndex(list);
	await fsp.unlink(photoFile(id)).catch(() => {});
	return true;
}
