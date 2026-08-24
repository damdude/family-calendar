/**
 * At-rest encryption (AES-256-GCM), server-only.
 *
 * The key is derived from a device-bound secret so ciphertext is meaningless if
 * the storage is copied off the device:
 *   key = scrypt( deviceSecret || machineId , salt )
 * - deviceSecret: 32 random bytes generated on first use, stored 0600 in
 *   data/device-secret (gitignored, never leaves the device).
 * - machineId: /etc/machine-id on a Pi (overridable via MACHINE_ID_PATH),
 *   falling back to the hostname off-device.
 *
 * Pulled forward from Batch 4 because photos must be encrypted at rest. Batch 4
 * builds the encrypted SQLite fields (OAuth tokens, notes) on this same helper.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DATA_DIR } from './paths';

const SECRET_PATH = path.join(DATA_DIR, 'device-secret');

function machineId(): string {
	const p = process.env.MACHINE_ID_PATH || '/etc/machine-id';
	try {
		const id = fs.readFileSync(p, 'utf8').trim();
		if (id) return id;
	} catch {
		/* not a Pi / unreadable */
	}
	return os.hostname() || 'family-calendar';
}

function deviceSecret(): Buffer {
	try {
		return Buffer.from(fs.readFileSync(SECRET_PATH, 'utf8').trim(), 'hex');
	} catch {
		const secret = crypto.randomBytes(32);
		fs.mkdirSync(DATA_DIR, { recursive: true });
		fs.writeFileSync(SECRET_PATH, secret.toString('hex'), { mode: 0o600 });
		return secret;
	}
}

let keyCache: Buffer | null = null;
function key(): Buffer {
	if (!keyCache) {
		const material = Buffer.concat([deviceSecret(), Buffer.from(machineId(), 'utf8')]);
		keyCache = crypto.scryptSync(material, 'family-calendar-atrest-v1', 32);
	}
	return keyCache;
}

// Same device-bound material as the at-rest key, but derived with a distinct
// salt so a session-signing key is never the same bytes as the encryption
// key even though they share a root secret — used to HMAC-sign the PIN
// session cookie (see session.ts).
let sessionKeyCache: Buffer | null = null;
export function sessionSigningKey(): Buffer {
	if (!sessionKeyCache) {
		const material = Buffer.concat([deviceSecret(), Buffer.from(machineId(), 'utf8')]);
		sessionKeyCache = crypto.scryptSync(material, 'family-calendar-session-v1', 32);
	}
	return sessionKeyCache;
}

/** AES-256-GCM. Output layout: [iv(12)][tag(16)][ciphertext]. */
export function encrypt(plain: Buffer): Buffer {
	const iv = crypto.randomBytes(12);
	const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
	const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
	return Buffer.concat([iv, cipher.getAuthTag(), ct]);
}

export function decrypt(blob: Buffer): Buffer {
	const iv = blob.subarray(0, 12);
	const tag = blob.subarray(12, 28);
	const ct = blob.subarray(28);
	const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
	decipher.setAuthTag(tag);
	return Buffer.concat([decipher.update(ct), decipher.final()]);
}

export const encryptString = (s: string): Buffer => encrypt(Buffer.from(s, 'utf8'));
export const decryptString = (b: Buffer): string => decrypt(b).toString('utf8');
