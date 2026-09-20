/**
 * PIN-backed session cookie for the small set of device/network-control API
 * routes that don't otherwise have any access control (see hooks.server.ts).
 * Not a login system with accounts — this is a single shared-PIN appliance,
 * so a "session" just proves "this browser verified the PIN recently," the
 * same trust level the on-screen parental lock already implies.
 *
 * Token layout: base64url(JSON payload) + "." + HMAC-SHA256(that, deviceKey).
 * Self-contained (no server-side session store to prune) and device-bound
 * (signed with a key derived from the same device secret as at-rest
 * encryption — see crypto.ts), so a copied cookie is useless off-device.
 */

import crypto from 'node:crypto';
import { sessionSigningKey } from './crypto';

export const SESSION_COOKIE = 'fc_session';
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — re-enter the PIN roughly monthly, not every visit
export const SESSION_MAX_AGE_SECONDS = TTL_MS / 1000;

/**
 * 'pin' proves the parental PIN was entered; 'elevated' proves the device
 * LOGIN password was entered just now, and is what the genuinely destructive
 * actions require (installing an update, wiping the device, moving where data
 * lives). Elevated is deliberately short-lived: it should cover the action the
 * family is in the middle of, not linger on a screen anyone walks past.
 */
export type SessionScope = 'pin' | 'elevated';
export const ELEVATED_COOKIE = 'fc_elevated';
const ELEVATED_TTL_MS = 5 * 60 * 1000;
export const ELEVATED_MAX_AGE_SECONDS = ELEVATED_TTL_MS / 1000;

function sign(b64Payload: string): string {
	return crypto.createHmac('sha256', sessionSigningKey()).update(b64Payload).digest('base64url');
}

export function createSessionToken(scope: SessionScope = 'pin'): string {
	const b64 = Buffer.from(JSON.stringify({ iat: Date.now(), scope })).toString('base64url');
	return `${b64}.${sign(b64)}`;
}

export function isValidSessionToken(
	token: string | undefined | null,
	scope: SessionScope = 'pin'
): boolean {
	if (!token) return false;
	const dot = token.indexOf('.');
	if (dot < 0) return false;
	const b64 = token.slice(0, dot);
	const sig = token.slice(dot + 1);

	let expected: Buffer;
	let actual: Buffer;
	try {
		expected = Buffer.from(sign(b64));
		actual = Buffer.from(sig);
	} catch {
		return false;
	}
	if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return false;

	try {
		const payload = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
		if (typeof payload.iat !== 'number') return false;
		// Tokens minted before scopes existed carry no scope; they were only
		// ever PIN sessions, so treat them as such rather than rejecting them.
		const tokenScope: SessionScope = payload.scope === 'elevated' ? 'elevated' : 'pin';
		if (tokenScope !== scope) return false;
		const ttl = scope === 'elevated' ? ELEVATED_TTL_MS : TTL_MS;
		return Date.now() - payload.iat <= ttl;
	} catch {
		return false;
	}
}
