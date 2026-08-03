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

/** Run a shell command, always returning combined stdout+stderr (never throws). */
function runCapture(cmd: string, timeoutMs = 4000): Promise<string> {
	return new Promise((resolve) => {
		let child;
		try {
			child = spawn('sh', ['-c', cmd], { stdio: ['ignore', 'pipe', 'pipe'] });
		} catch (e) {
			return resolve(`$ ${cmd}\n(failed to spawn: ${e})\n`);
		}
		let out = `$ ${cmd}\n`;
		let done = false;
		const finish = () => {
			if (!done) {
				done = true;
				resolve(out);
			}
		};
		const timer = setTimeout(() => {
			child.kill('SIGKILL');
			out += '(timed out)\n';
			finish();
		}, timeoutMs);
		child.stdout.on('data', (d) => (out += d.toString()));
		child.stderr.on('data', (d) => (out += d.toString()));
		child.on('error', (e) => {
			clearTimeout(timer);
			out += `(error: ${e})\n`;
			finish();
		});
		child.on('close', () => {
			clearTimeout(timer);
			finish();
		});
	});
}

/**
 * A compact snapshot of Wi-Fi bring-up state for the setup screen's on-device
 * debug panel — the only way to see what's happening on a Pi that has no
 * network yet (no SSH, no logs reachable any other way). Static, capped size:
 * last N lines from each source so a screenshot always fits.
 */
export async function wifiDebugSnapshot(): Promise<string> {
	const cmds = [
		'systemctl is-active family-calendar-wifi.service NetworkManager.service 2>&1',
		'rfkill list wifi 2>&1',
		'nmcli -t -f DEVICE,TYPE,STATE,CONNECTION device 2>&1',
		'journalctl -u family-calendar-wifi.service --no-pager -n 12 -o cat 2>&1'
	];
	const parts = await Promise.all(cmds.map((c) => runCapture(c)));
	const combined = parts.join('\n').trim();
	return combined || '(no diagnostics available on this host)';
}
