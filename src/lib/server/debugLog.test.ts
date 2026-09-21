import { describe, it, expect } from 'vitest';
import { redact } from './debugLog';

/**
 * Redaction failing is silent — the log keeps being written, it just starts
 * containing credentials. These assert the property directly.
 */
describe('redact', () => {
	it('masks sensitive keys but keeps their length', () => {
		const out = redact({ password: 'hunter2' }) as Record<string, string>;
		expect(out.password).toBe('[redacted 7 chars]');
		expect(out.password).not.toContain('hunter2');
	});

	it('covers every credential-ish key this app actually passes around', () => {
		const out = redact({
			newPassword: 'a',
			googleClientSecret: 'b',
			refreshToken: 'c',
			accessToken: 'd',
			passphrase: 'e',
			authorization: 'f',
			cookie: 'g',
			psk: 'h'
		}) as Record<string, string>;
		for (const [k, v] of Object.entries(out)) {
			expect(v, k).toMatch(/^\[redacted \d+ chars\]$/);
		}
	});

	it('distinguishes empty from present without revealing either', () => {
		const out = redact({ secret: '' }) as Record<string, string>;
		expect(out.secret).toBe('[empty]');
	});

	it('reaches sensitive keys nested inside objects and arrays', () => {
		const out = redact({
			profiles: [{ name: 'Rahul', googleRefreshToken: 'super-secret-value' }]
		}) as { profiles: { name: string; googleRefreshToken: string }[] };
		expect(out.profiles[0].name).toBe('Rahul');
		expect(out.profiles[0].googleRefreshToken).not.toContain('super-secret');
	});

	it('keeps ordinary values readable', () => {
		const out = redact({ ssid: 'RedFort', status: 404, ok: false }) as Record<string, unknown>;
		expect(out).toEqual({ ssid: 'RedFort', status: 404, ok: false });
	});

	it('truncates very long non-sensitive strings instead of filling the log', () => {
		const out = redact({ note: 'x'.repeat(1000) }) as Record<string, string>;
		expect(out.note.length).toBeLessThan(340);
		expect(out.note).toContain('+700');
	});

	it('does not recurse without bound', () => {
		type Deep = { a?: Deep };
		const deep: Deep = {};
		let cur = deep;
		for (let i = 0; i < 30; i++) cur = cur.a = {};
		expect(() => redact(deep)).not.toThrow();
	});
});
