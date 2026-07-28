/**
 * Encrypted avatar-photo storage, server-only.
 * Each photo is stored at data/uploads/avatar-<id>.enc as an encrypted
 * container: [mimeLen(1)][mime][imageBytes]. Plaintext never touches disk.
 */

import fsp from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR } from './paths';
import { encrypt, decrypt } from './crypto';

const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

function avatarFile(id: number): string {
	return path.join(UPLOAD_DIR, `avatar-${id}.enc`);
}

export async function saveAvatar(id: number, mime: string, bytes: Buffer): Promise<void> {
	const mimeBuf = Buffer.from(mime, 'utf8').subarray(0, 255);
	const container = Buffer.concat([Buffer.from([mimeBuf.length]), mimeBuf, bytes]);
	const enc = encrypt(container);
	await fsp.mkdir(UPLOAD_DIR, { recursive: true });
	const tmp = `${avatarFile(id)}.tmp`;
	await fsp.writeFile(tmp, enc);
	await fsp.rename(tmp, avatarFile(id));
}

export async function readAvatar(id: number): Promise<{ mime: string; bytes: Buffer } | null> {
	try {
		const container = decrypt(await fsp.readFile(avatarFile(id)));
		const mimeLen = container[0];
		const mime = container.subarray(1, 1 + mimeLen).toString('utf8');
		const bytes = container.subarray(1 + mimeLen);
		return { mime, bytes };
	} catch {
		return null;
	}
}
