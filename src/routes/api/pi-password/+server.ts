import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { spawn } from 'node:child_process';
import { getSession } from '$lib/server/pairing';
import { loadConfig, saveConfig } from '$lib/server/config';
import type { RequestHandler } from './$types';

/** Control characters would corrupt the single `user:password` line the helper
 *  feeds to chpasswd, so they are refused outright rather than escaped. */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x1f\x7f]/;

const BodySchema = z.object({
	token: z.string(),
	newPassword: z
		.string()
		.min(6, 'Use at least 6 characters.')
		.max(128)
		.refine((v) => !CONTROL_CHARS.test(v), 'That password contains unsupported characters.'),
	confirmPassword: z.string()
});

/**
 * Set the appliance user's login/SSH password during setup.
 *
 * Gated on a live setup pairing token: only someone who scanned the QR on the
 * display can reach it, and it stops working once setup is finished. Without
 * that, anything on the LAN could change the device password unprompted.
 *
 * The password goes to the privileged helper over stdin — never interpolated
 * into a shell string, and never an argv element where `ps` could read it.
 */
export const POST: RequestHandler = async ({ request }) => {
	const parsed = BodySchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, parsed.error.issues[0]?.message ?? 'invalid request');

	const { token, newPassword, confirmPassword } = parsed.data;
	if (!getSession(token)) throw error(403, 'This setup session has expired.');
	if (newPassword !== confirmPassword) throw error(400, 'The passwords do not match.');

	const result = await new Promise<{ ok: boolean; message?: string }>((resolve) => {
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
		child.stdin.write(newPassword + '\n');
		child.stdin.end();
	});

	if (!result.ok) {
		console.error('Password change failed:', result.message);
		throw error(500, 'Could not change the device password.');
	}

	// From here on the device has a password the family actually chose, so the
	// privileged actions can start demanding it.
	const config = await loadConfig();
	if (!config.devicePasswordSet) await saveConfig({ ...config, devicePasswordSet: true });

	return json({ ok: true });
};
