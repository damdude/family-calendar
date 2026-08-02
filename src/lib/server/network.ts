/**
 * Network connectivity check (server-only).
 *
 * On first boot the Pi has no Wi-Fi. A companion systemd service runs Balena
 * `wifi-connect`, which broadcasts a setup hotspot + captive portal so a phone
 * can hand over the home Wi-Fi credentials. This module lets the setup screen
 * know whether we're still offline (show "join my hotspot") or online (show the
 * pairing QR). On a dev box without NetworkManager we report online, so the
 * normal flow is unaffected.
 */

import { spawn } from 'node:child_process';

/** SSID of the first-boot setup hotspot. Must match the wifi-connect service. */
export const SETUP_AP_SSID = 'FamilyCalendar Setup';

function run(cmd: string, args: string[], timeoutMs = 5000): Promise<string | null> {
	return new Promise((resolve) => {
		let child;
		try {
			child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'ignore'] });
		} catch {
			return resolve(null);
		}
		let out = '';
		let done = false;
		const finish = (v: string | null) => {
			if (!done) {
				done = true;
				resolve(v);
			}
		};
		const timer = setTimeout(() => {
			child.kill('SIGKILL');
			finish(null);
		}, timeoutMs);
		child.stdout.on('data', (d) => (out += d.toString()));
		child.on('error', () => {
			clearTimeout(timer);
			finish(null);
		});
		child.on('close', (code) => {
			clearTimeout(timer);
			finish(code === 0 ? out : null);
		});
	});
}

/**
 * Is the Pi on a usable network (home Wi-Fi or Ethernet)? "limited" counts —
 * setup pairing only needs the phone and Pi on the same LAN, not the internet.
 * Returns true when NetworkManager isn't present (dev machine) so we never wrap
 * a normal browser in the hotspot flow.
 */
export async function isOnline(): Promise<boolean> {
	const out = await run('nmcli', ['-t', '-f', 'CONNECTIVITY', 'general']);
	if (out === null) return true; // no nmcli → assume online (dev / non-Pi)
	const state = out.trim().toLowerCase();
	return state === 'full' || state === 'limited';
}
