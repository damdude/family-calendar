/**
 * Setup pairing sessions (server-only, in-memory).
 *
 * A pairing token gates the phone wizard and the kiosk↔phone channel. Tokens
 * are rotated each time the kiosk opens /setup and hold an in-progress draft
 * that the phone updates and completion persists. Expiry is a sliding
 * inactivity window (20 min since the session was last touched), not a flat
 * timer from creation — filling in a whole family (several kids, each with a
 * date-of-birth picker, color, avatar) can easily take longer than a fixed
 * "since scanned" timer allows, and there was no warning before it lapsed.
 * An abandoned scan still expires; active use never does.
 *
 * In-memory is intentional: pairing state should never survive a restart, and
 * a single-family appliance has exactly one kiosk.
 */

import crypto from 'node:crypto';
import { emptyDraft, type SetupDraft } from '$lib/setup/types';

const TTL_MS = 20 * 60 * 1000;

export interface PairingSession {
	token: string;
	createdAt: number;
	lastActiveAt: number;
	claimedAt?: number;
	draft: SetupDraft;
	completed: boolean;
}

const sessions = new Map<string, PairingSession>();

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
		completed: false
	});
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
	return s;
}

/** Mark a token claimed by the phone (single-use handshake). */
export function claimPairing(token: string): PairingSession | null {
	const s = getSession(token);
	if (s) {
		s.claimedAt = Date.now();
		s.lastActiveAt = s.claimedAt;
	}
	return s;
}

export function updateDraft(token: string, draft: SetupDraft): PairingSession | null {
	const s = getSession(token);
	if (s) {
		s.draft = draft;
		s.lastActiveAt = Date.now();
	}
	return s;
}

export function markComplete(token: string): PairingSession | null {
	const s = getSession(token);
	if (s) {
		s.completed = true;
		s.lastActiveAt = Date.now();
	}
	return s;
}
