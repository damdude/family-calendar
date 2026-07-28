import os from 'node:os';

/**
 * First non-internal IPv4 address, for building the LAN pairing URL the phone
 * scans. Falls back to localhost when only loopback is available.
 */
export function localIPv4(): string {
	const ifaces = os.networkInterfaces();
	for (const name of Object.keys(ifaces)) {
		for (const iface of ifaces[name] ?? []) {
			if (iface.family === 'IPv4' && !iface.internal) return iface.address;
		}
	}
	return 'localhost';
}
