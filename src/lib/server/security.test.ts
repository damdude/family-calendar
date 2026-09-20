import { describe, it, expect } from 'vitest';
import { isPrivateIp } from './urlSafety';
import { sniffImageMime } from './imageSniff';
import { setEnvLine } from './envFile';

/**
 * These cover the checks that exist specifically to stop something bad, where
 * a regression is silent: the guard still returns a value, it's just the
 * wrong one, and nothing visibly breaks until it's exploited.
 */

describe('isPrivateIp (SSRF guard)', () => {
	it('rejects loopback, private and link-local v4', () => {
		for (const ip of [
			'127.0.0.1',
			'127.1.2.3',
			'10.0.0.1',
			'172.16.0.1',
			'172.31.255.255',
			'192.168.1.1',
			'0.0.0.0'
		]) {
			expect(isPrivateIp(ip), ip).toBe(true);
		}
	});

	it('rejects the cloud metadata address', () => {
		expect(isPrivateIp('169.254.169.254')).toBe(true);
	});

	it('allows ordinary public v4', () => {
		for (const ip of ['8.8.8.8', '1.1.1.1', '172.15.0.1', '172.32.0.1', '93.184.216.34']) {
			expect(isPrivateIp(ip), ip).toBe(false);
		}
	});

	it('rejects v6 loopback, link-local and unique-local', () => {
		for (const ip of ['::1', 'fe80::1', 'fc00::1', 'fd12:3456::1']) {
			expect(isPrivateIp(ip), ip).toBe(true);
		}
	});

	it('sees through IPv4-mapped IPv6', () => {
		expect(isPrivateIp('::ffff:127.0.0.1')).toBe(true);
		expect(isPrivateIp('::ffff:192.168.0.1')).toBe(true);
		expect(isPrivateIp('::ffff:8.8.8.8')).toBe(false);
	});

	it('refuses anything it cannot parse rather than allowing it', () => {
		for (const junk of ['', 'not-an-ip', '999.999.999.999', 'localhost']) {
			expect(isPrivateIp(junk), junk).toBe(true);
		}
	});
});

describe('sniffImageMime (upload spoofing guard)', () => {
	const pad = (head: number[], len = 32) =>
		Buffer.concat([Buffer.from(head), Buffer.alloc(Math.max(0, len - head.length))]);

	it('identifies real formats from magic bytes', () => {
		expect(sniffImageMime(pad([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
		expect(sniffImageMime(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png');
		expect(sniffImageMime(pad([...Buffer.from('GIF89a')]))).toBe('image/gif');
		expect(sniffImageMime(pad([0x42, 0x4d]))).toBe('image/bmp');
	});

	it('rejects SVG however it is labelled — this is the stored-XSS vector', () => {
		const svg = Buffer.from(
			'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
		);
		expect(sniffImageMime(svg)).toBeNull();
	});

	it('rejects HTML and arbitrary data', () => {
		expect(sniffImageMime(Buffer.from('<!DOCTYPE html><html><body>hi</body></html>'))).toBeNull();
		expect(sniffImageMime(Buffer.alloc(64))).toBeNull();
	});

	it('rejects input too short to identify', () => {
		expect(sniffImageMime(Buffer.from([0xff, 0xd8, 0xff]))).toBeNull();
	});
});

describe('setEnvLine', () => {
	it('replaces an existing key in place', () => {
		const out = setEnvLine('A=1\nB=2\nC=3', 'B', 'changed');
		expect(out).toBe('A=1\nB=changed\nC=3');
	});

	it('appends a key that is not present', () => {
		expect(setEnvLine('A=1\n', 'B', '2')).toBe('A=1\nB=2\n');
	});

	it('keeps comments and unrelated keys untouched', () => {
		const src = '# a comment\nKEEP=yes\nTARGET=old\n# trailing note\n';
		const out = setEnvLine(src, 'TARGET', 'new');
		expect(out).toContain('# a comment');
		expect(out).toContain('KEEP=yes');
		expect(out).toContain('# trailing note');
		expect(out).toContain('TARGET=new');
		expect(out).not.toContain('TARGET=old');
	});

	it('does not match a key that is merely a prefix of another', () => {
		const out = setEnvLine(
			'GOOGLE_OAUTH_CLIENT_ID=id\nGOOGLE_OAUTH_CLIENT_SECRET=sec',
			'GOOGLE_OAUTH_CLIENT_SECRET',
			'new'
		);
		expect(out).toBe('GOOGLE_OAUTH_CLIENT_ID=id\nGOOGLE_OAUTH_CLIENT_SECRET=new');
	});

	it('handles an empty file', () => {
		expect(setEnvLine('', 'A', '1')).toBe('\nA=1\n');
	});
});
