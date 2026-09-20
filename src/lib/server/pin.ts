/**
 * Admin PIN (parental lock), server-only. Stored as a scrypt hash + salt in
 * data/admin.json — never the PIN itself. Low-stakes gate for a home device,
 * but hashed + constant-time compared regardless.
 */

import crypto from 'node:crypto';
import { promisify } from 'node:util';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR } from './paths';
import { atomicWriteFile } from './atomicWrite';

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

/** scrypt is deliberately slow; run it off the event loop so a PIN check
 *  doesn't freeze every other request on this single-core-ish device. */
const scrypt = promisify(crypto.scrypt) as (
	password: string,
	salt: Buffer,
	keylen: number
) => Promise<Buffer>;

function hash(pin: string, salt: Buffer): Promise<Buffer> {
	return scrypt(pin, salt, 64);
}

export async function setPin(pin: string): Promise<void> {
	const salt = crypto.randomBytes(16);
	const rec: PinRecord = {
		salt: salt.toString('hex'),
		hash: (await hash(pin, salt)).toString('hex')
	};
	await fsp.mkdir(DATA_DIR, { recursive: true });
	await atomicWriteFile(FILE, JSON.stringify(rec), { mode: 0o600 });
}

export async function verifyPin(pin: string): Promise<boolean> {
	const rec = await read();
	if (!rec) return false;
	const salt = Buffer.from(rec.salt, 'hex');
	const expected = Buffer.from(rec.hash, 'hex');
	const actual = await hash(pin, salt);
	return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}
