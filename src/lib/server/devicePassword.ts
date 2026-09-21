/**
 * Setting the appliance user's login/SSH password.
 *
 * Shared by the setup wizard (which chooses one) and the factory reset (which
 * puts it back to the shipped default), so the two can't drift apart in how
 * they talk to the privileged helper.
 */

import { spawn } from 'node:child_process';

/**
 * What a freshly flashed card boots with — see the pi-gen image build. A
 * factory reset restores this so the device really is back to as-shipped;
 * the setup wizard is where a family chooses their own.
 */
export const DEFAULT_DEVICE_PASSWORD = 'changeme';

/** Control characters would corrupt the single `user:password` line the helper
 *  feeds to chpasswd, so they are refused rather than escaped. */
// eslint-disable-next-line no-control-regex
export const CONTROL_CHARS = /[\x00-\x1f\x7f]/;

/**
 * Hand the password to the privileged helper over stdin — never interpolated
 * into a shell string, and never an argv element where `ps` could read it.
 */
export function setDevicePassword(password: string): Promise<{ ok: boolean; message?: string }> {
	if (!password || CONTROL_CHARS.test(password)) {
		return Promise.resolve({ ok: false, message: 'unsupported password' });
	}
	return new Promise((resolve) => {
		let child;
		try {
			child = spawn('sudo', ['/usr/local/bin/fc-set-password'], {
				stdio: ['pipe', 'ignore', 'pipe']
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
		}, 15_000);
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
		child.stdin.on('error', () => {
			/* the helper can exit before the write lands; `close` decides */
		});
		child.stdin.write(password + '\n');
		child.stdin.end();
	});
}
