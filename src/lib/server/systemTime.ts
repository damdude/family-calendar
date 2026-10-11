/**
 * Applying the family's chosen IANA time zone to the OS clock.
 *
 * config.family.timezone has always been collected by the setup wizard and
 * stored, but nothing ever did anything with it — the device just ran on
 * whatever zone the image shipped with (UTC, on an unconfigured Pi), which is
 * why a family's calendar could show the wrong local time indefinitely.
 *
 * Applying it needs root (timedatectl), so it goes through the same
 * privileged-helper-plus-sudoers pattern as every other system change here.
 */

import { spawn } from 'node:child_process';

/** Only ever call this with a zone the browser itself reported via
 *  Intl.supportedValuesOf('timeZone') or picked from that same list server
 *  side — this is belt-and-suspenders validation before it reaches a
 *  subprocess, not the only check. */
export function isKnownTimeZone(zone: string): boolean {
	try {
		// Throws RangeError for anything Intl doesn't recognise as a zone.
		Intl.DateTimeFormat(undefined, { timeZone: zone });
		return true;
	} catch {
		return false;
	}
}

export function applySystemTimezone(zone: string): Promise<{ ok: boolean; message?: string }> {
	if (!isKnownTimeZone(zone)) {
		return Promise.resolve({ ok: false, message: 'unrecognised time zone' });
	}
	return new Promise((resolve) => {
		let child;
		try {
			child = spawn('sudo', ['/usr/local/bin/fc-set-timezone', zone], {
				stdio: ['ignore', 'ignore', 'pipe']
			});
		} catch {
			return resolve({ ok: false, message: 'helper unavailable' });
		}
		let done = false;
		const finish = (v: { ok: boolean; message?: string }) => {
			if (!done) {
				done = true;
				resolve(v);
			}
		};
		const timer = setTimeout(() => {
			child.kill('SIGKILL');
			finish({ ok: false, message: 'timed out' });
		}, 10_000);
		let errOut = '';
		child.stderr.on('data', (d) => (errOut += d.toString()));
		child.on('error', () => {
			clearTimeout(timer);
			finish({ ok: false, message: 'helper unavailable' });
		});
		child.on('close', (code) => {
			clearTimeout(timer);
			finish(code === 0 ? { ok: true } : { ok: false, message: errOut.trim() || 'failed' });
		});
	});
}
