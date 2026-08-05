import os from 'node:os';

/** wifi-connect's captive-portal subnet — the Pi's own setup hotspot, never a LAN. */
const SETUP_AP_SUBNET = '192.168.42.';

/**
 * First non-internal IPv4 address, for building the LAN pairing URL the phone
 * scans. Falls back to localhost when only loopback is available.
 *
 * Skips the setup hotspot's own gateway address: while onboarding is running,
 * that's the first non-internal address on the box, but it's only reachable
 * from the hotspot itself — a pairing URL pointing there is useless once the
 * phone rejoins the home network.
 */
export function localIPv4(): string {
	const addresses: string[] = [];
	const ifaces = os.networkInterfaces();
	for (const name of Object.keys(ifaces)) {
		for (const iface of ifaces[name] ?? []) {
			if (iface.family === 'IPv4' && !iface.internal) addresses.push(iface.address);
		}
	}
	return addresses.find((a) => !a.startsWith(SETUP_AP_SUBNET)) ?? addresses[0] ?? 'localhost';
}
