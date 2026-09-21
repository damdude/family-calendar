/**
 * Append-only diagnostic log, written to data/debug.log as JSON lines.
 *
 * Exists because the interesting failures on this device happen during the
 * setup wizard — the one time Settings is unreachable, the screen may be a TV
 * with no keyboard, and the person debugging is not in the room. Several bugs
 * in this project were found only by reasoning backwards from a single
 * user-visible string; a record of what actually happened is cheaper.
 *
 * Never records secrets. Values under keys that look sensitive (password,
 * secret, token, passphrase, key) are replaced with a marker that keeps the
 * length, because "was it empty / was it the wrong length" is usually the
 * question worth answering and the value itself never is.
 */

import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './paths';

const LOG_PATH = path.join(DATA_DIR, 'debug.log');
const PREV_PATH = path.join(DATA_DIR, 'debug.log.1');
/** Rotate well short of anything that could fill a small SD card. */
const MAX_BYTES = 2 * 1024 * 1024;

const SENSITIVE = /pass|secret|token|passphrase|credential|refresh|authorization|cookie|psk/i;

/**
 * Mirrors app.debugLogging from config.json. Cached rather than read per call
 * because logEvent is synchronous and sits in the request path; config.ts
 * refreshes this whenever it loads or saves, which is often enough that a
 * toggle in Settings takes effect immediately with no restart.
 */
let configEnabled = true;
export function setDebugEnabled(on: boolean): void {
	configEnabled = on;
}

/**
 * FC_DEBUG wins if set, so a device can be forced quiet (or loud) without
 * reaching the UI. Otherwise the setting decides, defaulting on: the run
 * worth capturing is usually the first one, and nobody gets the chance to
 * enable anything beforehand.
 */
export function debugEnabled(): boolean {
	if (process.env.FC_DEBUG === '0') return false;
	if (process.env.FC_DEBUG === '1') return true;
	return configEnabled;
}

export function redact(value: unknown, keyHint = '', depth = 0): unknown {
	if (depth > 6) return '[deep]';
	if (value === null || value === undefined) return value;

	if (typeof value === 'string') {
		if (SENSITIVE.test(keyHint)) return value ? `[redacted ${value.length} chars]` : '[empty]';
		return value.length > 300 ? `${value.slice(0, 300)}…[+${value.length - 300}]` : value;
	}
	if (typeof value === 'number' || typeof value === 'boolean') return value;
	if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, keyHint, depth + 1));
	if (typeof value === 'object') {
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
			out[k] = redact(v, k, depth + 1);
		}
		return out;
	}
	return `[${typeof value}]`;
}

function rotateIfNeeded() {
	try {
		if (fs.statSync(LOG_PATH).size < MAX_BYTES) return;
		fs.rmSync(PREV_PATH, { force: true });
		fs.renameSync(LOG_PATH, PREV_PATH);
	} catch {
		/* no log yet, or the rotate raced another write — next line retries */
	}
}

/**
 * Record one event. Deliberately synchronous and best-effort: a diagnostic
 * that throws, or that loses the last few lines before a crash because they
 * were still queued, is worse than useless.
 */
export function logEvent(event: string, details?: Record<string, unknown>): void {
	if (!debugEnabled()) return;
	try {
		const line =
			JSON.stringify({
				t: new Date().toISOString(),
				event,
				...(details ? (redact(details) as Record<string, unknown>) : {})
			}) + '\n';
		fs.mkdirSync(DATA_DIR, { recursive: true });
		rotateIfNeeded();
		fs.appendFileSync(LOG_PATH, line);
	} catch {
		/* logging must never break the request it is describing */
	}
}

export const DEBUG_LOG_PATH = LOG_PATH;
