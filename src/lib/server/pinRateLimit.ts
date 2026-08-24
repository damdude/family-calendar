/**
 * Rate limit for PIN attempts (both /api/pin/verify and the `current` PIN
 * check in /api/pin). A 4-digit PIN is only 10,000 combinations — with no
 * limit at all it's crackable in well under a minute by anything on the
 * network. Global rather than per-IP: this is a single shared-PIN appliance
 * with no legitimate reason for many parallel attempts, and a global counter
 * can't be split by spraying attempts from multiple source ports/addresses.
 */

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60_000;
const LOCKOUT_MS = 30_000;

let attempts = 0;
let windowStart = Date.now();
let lockedUntil = 0;

export function pinAttemptAllowed(): boolean {
	const now = Date.now();
	if (now < lockedUntil) return false;
	if (now - windowStart > WINDOW_MS) {
		attempts = 0;
		windowStart = now;
	}
	return attempts < MAX_ATTEMPTS;
}

export function recordPinAttempt(success: boolean): void {
	if (success) {
		attempts = 0;
		lockedUntil = 0;
		return;
	}
	attempts++;
	if (attempts >= MAX_ATTEMPTS) lockedUntil = Date.now() + LOCKOUT_MS;
}
