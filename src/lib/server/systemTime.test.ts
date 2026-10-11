import { describe, it, expect } from 'vitest';
import { isKnownTimeZone } from './systemTime';

/**
 * This is the only check between a value the setup wizard or Settings page
 * sent and a string handed to a root-privileged subprocess. The shell script
 * also validates against /usr/share/zoneinfo, but that is defense in depth,
 * not the only check — this one has to actually reject nonsense.
 */
describe('isKnownTimeZone', () => {
	it('accepts real IANA zones', () => {
		for (const z of ['America/New_York', 'Europe/London', 'Asia/Kolkata', 'UTC', 'Etc/UTC']) {
			expect(isKnownTimeZone(z), z).toBe(true);
		}
	});

	it('rejects garbage, empty, and shell-meaningful input', () => {
		for (const z of ['', 'not-a-zone', 'America/Nowhere', '; rm -rf /', '../../etc/passwd']) {
			expect(isKnownTimeZone(z), z).toBe(false);
		}
	});
});
