/**
 * Verifies the device LOGIN password — the one the family chose in the setup
 * wizard, which is also the SSH/console password.
 *
 * This is checked by handing it to `sudo -S -k true` on stdin: sudo validates
 * it against PAM (the real shadow entry), which is the only way to check a
 * Unix password without reading /etc/shadow as root ourselves. `-k` discards
 * any cached sudo credential first, so every call is a genuine check rather
 * than a timestamp hit. The password is never a shell string and never an
 * argv element.
 *
 * This only became a real check once the blanket
 * `/etc/sudoers.d/010_pi-nopasswd` rule was removed — with that file in place
 * sudo never asks for anything, so this would have returned true for any
 * input at all.
 */

import { spawn } from 'node:child_process';

/** Anything that can't appear in the single line sudo reads from stdin. */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x1f\x7f]/;

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60_000;
const LOCKOUT_MS = 60_000;

let attempts = 0;
let windowStart = Date.now();
let lockedUntil = 0;

/** Global, not per-IP: one shared appliance password, and a per-IP counter
 *  would just be sprayed from different source addresses. */
export function devicePasswordAttemptAllowed(): boolean {
	const now = Date.now();
	if (now < lockedUntil) return false;
	if (now - windowStart > WINDOW_MS) {
		attempts = 0;
		windowStart = now;
	}
	return attempts < MAX_ATTEMPTS;
}

export function recordDevicePasswordAttempt(success: boolean): void {
	if (success) {
		attempts = 0;
		lockedUntil = 0;
		return;
	}
	attempts++;
	if (attempts >= MAX_ATTEMPTS) lockedUntil = Date.now() + LOCKOUT_MS;
}

export function verifyDevicePassword(password: string): Promise<boolean> {
	if (!password || CONTROL_CHARS.test(password)) return Promise.resolve(false);

	return new Promise((resolve) => {
		let child;
		try {
			// `true` is deliberately NOT in the sudoers allowlist, so this always
			// falls through to the password prompt instead of being waved past.
			child = spawn('sudo', ['-S', '-k', 'true'], { stdio: ['pipe', 'ignore', 'ignore'] });
		} catch {
			return resolve(false);
		}
		let done = false;
		const finish = (v: boolean) => {
			if (!done) {
				done = true;
				resolve(v);
			}
		};
		// sudo imposes its own delay after a wrong password; give it room but
		// never hang the request.
		const timer = setTimeout(() => {
			child.kill('SIGKILL');
			finish(false);
		}, 20_000);
		child.on('error', () => {
			clearTimeout(timer);
			finish(false);
		});
		child.on('close', (code) => {
			clearTimeout(timer);
			finish(code === 0);
		});
		child.stdin.on('error', () => {
			/* sudo can exit before the write lands; `close` decides the result */
		});
		child.stdin.write(password + '\n');
		child.stdin.end();
	});
}
