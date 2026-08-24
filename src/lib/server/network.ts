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
import fs from 'node:fs';

/** SSID of the first-boot setup hotspot. Must match the wifi-connect service. */
export const SETUP_AP_SSID = 'FamilyCalendar Setup';

/** Same file scripts/wifi-setup.sh generates and passes to wifi-connect as
 *  --portal-passphrase. Read here so the setup screen's QR can encode the
 *  real, currently-broadcasting passphrase — the hotspot is WPA2-protected
 *  now (it used to be open to anyone in Wi-Fi range), but since the setup
 *  screen only ever asks a phone to scan a QR rather than type anything,
 *  putting the password in the QR keeps that flow completely unchanged.
 *  Null off-Pi (dev machine) or before the AP has ever started once. */
export function setupApPassphrase(): string | null {
	try {
		const psk = fs.readFileSync('/etc/family-calendar/setup-ap-psk', 'utf8').trim();
		return psk || null;
	} catch {
		return null;
	}
}

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
 * Is our own setup hotspot currently up? While wifi-connect hosts the AP,
 * wlan0 is "connected" and NetworkManager reports connectivity as "limited" —
 * which would otherwise look like a real network and flip the setup screen to
 * the pairing step, showing a QR pointing at the AP's own 192.168.42.1 gateway
 * (unreachable from anywhere but the hotspot itself). Detect AP mode so
 * onboarding is never mistaken for being online.
 */
export async function isSetupApActive(): Promise<boolean> {
	const active = await run('nmcli', ['-t', '-f', 'NAME,TYPE', 'connection', 'show', '--active']);
	if (!active) return false;
	// Terse output is NAME:TYPE; a connection name may itself contain an escaped
	// colon, so split on the LAST separator.
	const wifiNames = active
		.split('\n')
		.map((line) => {
			const i = line.lastIndexOf(':');
			return i < 0
				? null
				: { name: line.slice(0, i).replace(/\\:/g, ':'), type: line.slice(i + 1) };
		})
		.filter((x): x is { name: string; type: string } => !!x && x.type === '802-11-wireless')
		.map((x) => x.name);

	for (const name of wifiNames) {
		const mode = await run('nmcli', [
			'-t',
			'-f',
			'802-11-wireless.mode',
			'connection',
			'show',
			name
		]);
		if (mode && mode.trim().toLowerCase().endsWith(':ap')) return true;
	}
	return false;
}

/**
 * Is the Pi on a usable network (home Wi-Fi or Ethernet)? "limited" counts —
 * setup pairing only needs the phone and Pi on the same LAN, not the internet.
 * Returns true when NetworkManager isn't present (dev machine) so we never wrap
 * a normal browser in the hotspot flow.
 */
export async function isOnline(): Promise<boolean> {
	// Dev/testing escape hatch: lets the first-boot Wi-Fi step be exercised on a
	// laptop, which is otherwise always "online" and so always skips it. Opt-in
	// only — unset (the normal case, including every image build) changes nothing.
	if (process.env.FC_FORCE_OFFLINE === '1') return false;

	const out = await run('nmcli', ['-t', '-f', 'CONNECTIVITY', 'general']);
	if (out === null) return true; // no nmcli → assume online (dev / non-Pi)
	const state = out.trim().toLowerCase();
	if (state !== 'full' && state !== 'limited') return false;
	// Hosting the setup hotspot is onboarding, not being online.
	return !(await isSetupApActive());
}

export interface WifiStatus {
	online: boolean;
	/** Currently-associated SSID, or null when offline / on Ethernet. */
	ssid: string | null;
	/** 0-100, or null when unknown. */
	signal: number | null;
}

/**
 * Current connection at a glance — for the Settings panel and the TopBar
 * status icon. Deliberately cheap: unlike `scanWifi()` this never triggers a
 * rescan, so it's safe to poll every few seconds.
 */
export async function wifiStatus(): Promise<WifiStatus> {
	const online = await isOnline();
	if (!online) return { online, ssid: null, signal: null };
	const out = await run('nmcli', ['-t', '-f', 'ACTIVE,SSID,SIGNAL', 'device', 'wifi', 'list']);
	if (!out) return { online, ssid: null, signal: null };
	for (const line of out.split('\n')) {
		if (!line.trim()) continue;
		const parts = line.split(/(?<!\\):/).map((p) => p.replace(/\\:/g, ':'));
		if (parts[0]?.trim() === 'yes') {
			return { online, ssid: parts[1] || null, signal: Number(parts[2]) || null };
		}
	}
	// Associated but not seen in this scan's cache (e.g. Ethernet) — still online.
	return { online, ssid: null, signal: null };
}

export interface WifiNetwork {
	ssid: string;
	/** 0-100 */
	signal: number;
	secured: boolean;
	/** Currently connected to this one. */
	active: boolean;
}

/**
 * Nearby Wi-Fi networks, for the on-screen picker in touch mode. Strongest
 * first, de-duplicated by SSID (a mesh shows the same name several times) and
 * with hidden/blank SSIDs dropped. Empty when nmcli isn't available.
 */
export async function scanWifi(): Promise<WifiNetwork[]> {
	// Ask for a rescan so the list isn't stale; ignore failure (it's advisory).
	await run('nmcli', ['device', 'wifi', 'rescan'], 12000);
	const out = await run(
		'nmcli',
		['-t', '-f', 'IN-USE,SSID,SIGNAL,SECURITY', 'device', 'wifi', 'list'],
		12000
	);
	if (!out) return [];

	const best = new Map<string, WifiNetwork>();
	for (const line of out.split('\n')) {
		if (!line.trim()) continue;
		// Terse output escapes literal colons as "\:" — split on unescaped ones.
		const parts = line.split(/(?<!\\):/).map((p) => p.replace(/\\:/g, ':'));
		if (parts.length < 4) continue;
		const [inUse, ssid, signalRaw, security] = parts;
		if (!ssid || ssid === '--') continue;
		const net: WifiNetwork = {
			ssid,
			signal: Number(signalRaw) || 0,
			secured: !!security && security !== '' && security !== '--',
			active: inUse.trim() === '*'
		};
		const prev = best.get(ssid);
		if (!prev || net.signal > prev.signal)
			best.set(ssid, prev ? { ...net, active: prev.active || net.active } : net);
	}
	return [...best.values()].sort((a, b) => b.signal - a.signal);
}

/**
 * Join a Wi-Fi network via the privileged helper. The password travels over
 * stdin into a root-only NetworkManager keyfile — never as a process argument.
 */
export async function joinWifi(
	ssid: string,
	password: string
): Promise<{ ok: boolean; error?: string }> {
	// The helper (scripts/wifi-join.sh) writes ssid/password straight into an
	// INI-format .nmconnection file. A real SSID never contains a newline —
	// but a nearby rogue AP can broadcast one that does (SSIDs are just up to
	// 32 arbitrary bytes over the air), and an embedded CR/LF would start a
	// new line in that file, letting a picked network inject its own
	// directives (e.g. a rogue DNS server) into a root-owned config. Refuse
	// before it ever reaches the helper.
	if (/[\r\n]/.test(ssid) || /[\r\n]/.test(password)) {
		return { ok: false, error: 'That network name is not supported.' };
	}
	return new Promise((resolve) => {
		let child;
		try {
			child = spawn('sudo', ['/usr/local/bin/fc-wifi-join', ssid], {
				stdio: ['pipe', 'pipe', 'pipe']
			});
		} catch {
			return resolve({ ok: false, error: 'Wi-Fi join helper unavailable on this host.' });
		}
		let err = '';
		let done = false;
		const finish = (v: { ok: boolean; error?: string }) => {
			if (!done) {
				done = true;
				resolve(v);
			}
		};
		const timer = setTimeout(() => {
			child.kill('SIGKILL');
			finish({ ok: false, error: 'Timed out joining the network.' });
		}, 60_000);
		child.stderr.on('data', (d) => (err += d.toString()));
		child.on('error', () => {
			clearTimeout(timer);
			finish({ ok: false, error: 'Wi-Fi join helper unavailable on this host.' });
		});
		child.on('close', (code) => {
			clearTimeout(timer);
			if (code === 0) return finish({ ok: true });
			const msg =
				/secrets were required|no secrets|802-1x|invalid.*password|Passwords? or encryption keys/i.test(
					err
				)
					? 'That password was rejected. Please check it and try again.'
					: err.trim().split('\n').pop() || 'Could not join that network.';
			finish({ ok: false, error: msg });
		});
		child.stdin.write(password + '\n');
		child.stdin.end();
	});
}

/**
 * Force the setup hotspot to restart broadcasting. Restarting the onboarding
 * service re-runs its connectivity check from scratch and, if still offline,
 * launches a fresh access point — the only recovery available when the AP
 * failed to come up, hung, or a join attempt left it in a bad state. This is
 * also the only way to retry from the UI: a true TV can't tap anything, but a
 * touch-capable screen set to TV mode can trigger this by returning to
 * "Change screen type" and re-picking TV.
 */
export async function restartWifiAp(): Promise<{ ok: boolean; error?: string }> {
	const out = await run('sudo', ['systemctl', 'restart', 'family-calendar-wifi.service'], 15000);
	if (out === null) {
		return { ok: false, error: 'Could not restart the Wi-Fi setup service on this host.' };
	}
	return { ok: true };
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
		// Every saved profile + whether NM will autoconnect it — the direct
		// answer to "why didn't it reconnect on boot" (a missing/renamed
		// profile, or autoconnect=no, shows up immediately here).
		'nmcli -t -f NAME,TYPE,AUTOCONNECT,AUTOCONNECT-PRIORITY connection show 2>&1',
		'journalctl -u family-calendar-wifi.service --no-pager -n 20 -o cat 2>&1',
		'journalctl -u NetworkManager --no-pager -n 12 -o cat 2>&1'
	];
	const parts = await Promise.all(cmds.map((c) => runCapture(c)));
	const combined = parts.join('\n').trim();
	return combined || '(no diagnostics available on this host)';
}
