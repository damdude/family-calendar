/**
 * Admin PIN (parental lock), server-only. Stored as a scrypt hash + salt in
 * data/admin.json — never the PIN itself. Low-stakes gate for a home device,
 * but hashed + constant-time compared regardless.
 */

import crypto from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR } from './paths';

const FILE = path.join(DATA_DIR, 'admin.json');

interface PinRecord {
	salt: string;
	hash: string;
}

async function read(): Promise<PinRecord | null> {
	try {
		return JSON.parse(await fsp.readFile(FILE, 'utf8'));
	} catch {
		return null;
	}
}

export async function isPinSet(): Promise<boolean> {
	return (await read()) !== null;
}

function hash(pin: string, salt: Buffer): Buffer {
	return crypto.scryptSync(pin, salt, 64);
}

export async function setPin(pin: string): Promise<void> {
	const salt = crypto.randomBytes(16);
	const rec: PinRecord = { salt: salt.toString('hex'), hash: hash(pin, salt).toString('hex') };
	await fsp.mkdir(DATA_DIR, { recursive: true });
	const tmp = `${FILE}.tmp`;
	await fsp.writeFile(tmp, JSON.stringify(rec), { mode: 0o600 });
	await fsp.rename(tmp, FILE);
}

export async function verifyPin(pin: string): Promise<boolean> {
	const rec = await read();
	if (!rec) return false;
	const salt = Buffer.from(rec.salt, 'hex');
	const expected = Buffer.from(rec.hash, 'hex');
	const actual = hash(pin, salt);
	return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}
