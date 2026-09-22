/**
 * Setup pairing sessions (server-only).
 *
 * A pairing token gates the phone wizard and the kiosk↔phone channel, and
 * carries the in-progress draft that completion persists. Expiry is a sliding
 * inactivity window, not a flat timer from creation — filling in a whole
 * family takes as long as it takes, and there was no warning before it
 * lapsed.
 *
 * These used to be memory-only, on the reasoning that pairing state should
 * not survive a restart. In practice that meant powering the device off
 * halfway through setup threw away everything entered so far and left the
 * phone on a dead link, with no way forward but rescanning — and it was not
 * buying much: during setup the device has no password at all, so anything on
 * the network could already load /setup and mint itself a fresh token. So
 * they are now written to disk, ENCRYPTED with the device key, because the
 * draft can carry Google refresh tokens for accounts connected mid-wizard.
 *
 * The file is removed as soon as setup completes; nothing here outlives that.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { emptyDraft, type SetupDraft } from '$lib/setup/types';
import { DATA_DIR } from './paths';
import { decryptString, encryptString } from './crypto';

/**
 * Sliding inactivity window. Generous on purpose: setup is routinely
 * interrupted — someone leaves the house partway through — and coming back to
 * a dead link is a far more likely outcome than a stale token being abused on
 * a device that has no password yet. Still bounded, so a genuinely abandoned
 * setup does eventually stop being resumable.
 */
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

const STORE_PATH = path.join(DATA_DIR, 'setup-session.enc');

/** A Google account authorised during the wizard, before the profile it
 *  belongs to has a real id. */
export interface PendingGoogleToken {
	refreshToken: string;
	accessToken: string;
	accessExpiresAt: number;
}

export interface PairingSession {
	token: string;
	createdAt: number;
	lastActiveAt: number;
	claimedAt?: number;
	draft: SetupDraft;
	/**
	 * Google tokens captured mid-wizard, keyed by the DRAFT profile id, and
	 * deliberately kept out of `draft`: the draft is broadcast to the kiosk
	 * over SSE for the live preview, and refresh tokens have no business on
	 * that channel. Persisted against the real profile ids by
	 * /setup/complete, which is the first moment those ids exist.
	 */
	pendingGoogle: Map<string, PendingGoogleToken>;
	completed: boolean;
	// Flag: this token's page has been served (don't rotate on re-render)
	pageServed?: boolean;
}

const sessions = new Map<string, PairingSession>();

/** Shape written to disk — Map is not JSON, so pendingGoogle goes as pairs. */
type StoredSession = Omit<PairingSession, 'pendingGoogle'> & {
	pendingGoogle: [string, PendingGoogleToken][];
};

function persist(): void {
	try {
		const payload: StoredSession[] = [...sessions.values()].map((s) => ({
			...s,
			pendingGoogle: [...s.pendingGoogle.entries()]
		}));
		fs.mkdirSync(DATA_DIR, { recursive: true });
		fs.writeFileSync(STORE_PATH, encryptString(JSON.stringify(payload)), { mode: 0o600 });
	} catch {
		/* setup still works for this boot; it just won't survive the next one */
	}
}

function restore(): void {
	try {
		const raw = fs.readFileSync(STORE_PATH);
		const parsed = JSON.parse(decryptString(raw)) as StoredSession[];
		const now = Date.now();
		for (const s of parsed) {
			if (now - s.lastActiveAt > TTL_MS) continue;
			sessions.set(s.token, { ...s, pendingGoogle: new Map(s.pendingGoogle) });
		}
	} catch {
		/* no store, unreadable, or a device key change — start fresh */
	}
}

restore();

/** Remove the on-disk copy. Called once setup finishes; nothing about a
 *  configured device should still be resumable. */
export function clearPersistedSessions(): void {
	sessions.clear();
	try {
		fs.rmSync(STORE_PATH, { force: true });
	} catch {
		/* best effort */
	}
}

function prune() {
	const now = Date.now();
	for (const [token, s] of sessions) {
		if (now - s.lastActiveAt > TTL_MS) sessions.delete(token);
	}
}

/** Issue a fresh token (rotates: prior unclaimed tokens simply expire). */
export function createPairing(): { token: string; expiresAt: number } {
	prune();
	const token = crypto.randomBytes(16).toString('base64url');
	const now = Date.now();
	sessions.set(token, {
		token,
		createdAt: now,
		lastActiveAt: now,
		draft: emptyDraft(),
		pendingGoogle: new Map(),
		completed: false
	});
	persist();
	return { token, expiresAt: now + TTL_MS };
}

/** Return a live session for a token, or null if unknown/expired. */
export function getSession(token: string | null | undefined): PairingSession | null {
	if (!token) return null;
	prune();
	const s = sessions.get(token);
	if (!s) return null;
	if (Date.now() - s.lastActiveAt > TTL_MS) {
		sessions.delete(token);
		return null;
	}
	// Reading a live session counts as activity. Without this the "sliding
	// inactivity window" described above was really a fixed timer from
	// creation: a family that paused partway through the wizard came back to
	// a dead token, and the failure surfaced as whatever the step they were
	// on happened to be doing.
	s.lastActiveAt = Date.now();
	persist();
	return s;
}

/** Mark a token claimed by the phone (single-use handshake). */
export function claimPairing(token: string): PairingSession | null {
	const s = getSession(token);
	if (s) {
		s.claimedAt = Date.now();
		s.lastActiveAt = s.claimedAt;
		persist();
	}
	return s;
}

export function updateDraft(token: string, draft: SetupDraft): PairingSession | null {
	const s = getSession(token);
	if (s) {
		s.draft = draft;
		s.lastActiveAt = Date.now();
		persist();
	}
	return s;
}

/** Hold a Google authorisation until the profile it belongs to has a real id. */
export function stashPendingGoogle(
	token: string,
	draftProfileId: string,
	value: PendingGoogleToken
): boolean {
	const s = getSession(token);
	if (!s) return false;
	s.pendingGoogle.set(draftProfileId, value);
	persist();
	return true;
}

export function markComplete(token: string): PairingSession | null {
	const s = getSession(token);
	if (s) {
		s.completed = true;
		s.lastActiveAt = Date.now();
		persist();
	}
	return s;
}
