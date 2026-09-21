/**
 * Proof-of-presence recovery for a lost device password.
 *
 * Losing the password closes ssh, the update button and factory reset at the
 * same moment, so there has to be a way back. It must not be a remote one, or
 * it simply becomes a bypass for the gate it is meant to rescue.
 *
 * So: a short code is shown ON THE SCREEN, and typing it back proves whoever
 * is asking is standing in front of the display. The code is held in memory
 * and never written anywhere — no config, no log, no database — so it cannot
 * be read back off the disk afterwards, and it is only ever revealed to a
 * request arriving on the loopback interface, which is how the kiosk's own
 * browser reaches the server. Anything on the network gets a refusal.
 *
 * Residual, stated plainly: someone already logged in over ssh could ask
 * loopback for the code. That is not a new hole — ssh now requires the very
 * password being recovered, so reaching that position means already holding
 * it (or an ssh key, which is a trust relationship someone deliberately set
 * up).
 */

import crypto from 'node:crypto';

const TTL_MS = 5 * 60_000;
const MAX_ATTEMPTS = 5;

interface Challenge {
	code: string;
	expiresAt: number;
	attempts: number;
}

/** Deliberately module state: a recovery code that outlived a restart, or
 *  that could be found on disk, would defeat the point of it. */
let active: Challenge | null = null;

function live(): Challenge | null {
	if (!active) return null;
	if (Date.now() > active.expiresAt) {
		active = null;
		return null;
	}
	return active;
}

/** Begin a challenge. Returns when it expires — never the code itself, so
 *  this is safe to call from anywhere on the network. */
export function startRecovery(): { expiresAt: number } {
	const code = String(crypto.randomInt(0, 10_000)).padStart(4, '0');
	active = { code, expiresAt: Date.now() + TTL_MS, attempts: 0 };
	return { expiresAt: active.expiresAt };
}

/** The code, for display on the screen. Callers MUST have established that
 *  the request came from loopback; this function cannot check that itself. */
export function revealCode(): { code: string; expiresAt: number } | null {
	const c = live();
	return c ? { code: c.code, expiresAt: c.expiresAt } : null;
}

export type RecoveryResult = 'ok' | 'wrong' | 'expired' | 'locked';

export function verifyRecovery(input: string): RecoveryResult {
	const c = live();
	if (!c) return 'expired';
	if (c.attempts >= MAX_ATTEMPTS) return 'locked';
	c.attempts++;

	const a = Buffer.from(c.code);
	const b = Buffer.from(input.trim());
	const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
	if (!ok) return 'wrong';

	// Single use: a code that stays valid after it has worked is a code that
	// can be replayed by whoever glimpsed the screen.
	active = null;
	return 'ok';
}

export function cancelRecovery(): void {
	active = null;
}

/** True for a request that reached us over the loopback interface — i.e. the
 *  kiosk's own browser, not something on the LAN. */
export function isLoopback(address: string): boolean {
	return (
		address === '127.0.0.1' ||
		address === '::1' ||
		address === '::ffff:127.0.0.1' ||
		address.startsWith('127.')
	);
}
