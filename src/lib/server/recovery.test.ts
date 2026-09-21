import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { cancelRecovery, isLoopback, revealCode, startRecovery, verifyRecovery } from './recovery';

/**
 * The whole security property is "you must be in front of the screen". It
 * rests on two things that fail silently if broken: the loopback check, and
 * the code being single-use and short-lived.
 */

beforeEach(() => cancelRecovery());
afterEach(() => vi.useRealTimers());

describe('isLoopback', () => {
	it('accepts the forms a local request actually arrives as', () => {
		for (const a of ['127.0.0.1', '::1', '::ffff:127.0.0.1', '127.0.0.53']) {
			expect(isLoopback(a), a).toBe(true);
		}
	});

	it('rejects every LAN address — this is the proof of presence', () => {
		for (const a of [
			'192.168.7.21',
			'10.0.0.5',
			'172.16.3.9',
			'::ffff:192.168.7.21',
			'8.8.8.8',
			'',
			'localhost'
		]) {
			expect(isLoopback(a), a).toBe(false);
		}
	});
});

describe('recovery challenge', () => {
	it('starting one does not hand back the code', () => {
		const started = startRecovery();
		expect(started).toHaveProperty('expiresAt');
		expect(JSON.stringify(started)).not.toContain(revealCode()!.code);
	});

	it('issues a four-digit code', () => {
		startRecovery();
		expect(revealCode()!.code).toMatch(/^\d{4}$/);
	});

	it('accepts the right code exactly once', () => {
		startRecovery();
		const { code } = revealCode()!;
		expect(verifyRecovery(code)).toBe('ok');
		// Replay must fail: someone may have glimpsed the screen.
		expect(verifyRecovery(code)).toBe('expired');
	});

	it('rejects a wrong code without consuming the challenge', () => {
		startRecovery();
		const { code } = revealCode()!;
		const wrong = code === '0000' ? '1111' : '0000';
		expect(verifyRecovery(wrong)).toBe('wrong');
		expect(verifyRecovery(code)).toBe('ok');
	});

	it('locks out after repeated guesses rather than allowing 10,000 tries', () => {
		startRecovery();
		const { code } = revealCode()!;
		const wrong = code === '0000' ? '1111' : '0000';
		for (let i = 0; i < 5; i++) expect(verifyRecovery(wrong)).toBe('wrong');
		expect(verifyRecovery(wrong)).toBe('locked');
		// Even the correct code is refused once locked.
		expect(verifyRecovery(code)).toBe('locked');
	});

	it('expires, and stops revealing the code once it has', () => {
		vi.useFakeTimers();
		startRecovery();
		expect(revealCode()).not.toBeNull();
		vi.advanceTimersByTime(5 * 60_000 + 1000);
		expect(revealCode()).toBeNull();
		expect(verifyRecovery('0000')).toBe('expired');
	});

	it('reveals nothing when no challenge is running', () => {
		expect(revealCode()).toBeNull();
		expect(verifyRecovery('0000')).toBe('expired');
	});

	it('handles a length mismatch without throwing', () => {
		startRecovery();
		expect(() => verifyRecovery('1')).not.toThrow();
		expect(verifyRecovery('12345678')).toBe('wrong');
	});
});
