/** Background schedulers (server-only). Started once from hooks.server.ts. */

import cron from 'node-cron';
import { syncAll } from './sync';
import { refreshAllSites } from './sites';
import { publishLive } from './live';

let started = false;

export function startScheduler(): void {
	if (started) return;
	started = true;

	// Calendar sync (Google + ICS links) every 15 minutes (no-op when none).
	// Publishes a live-refresh afterward so an already-open display picks up
	// newly synced events without waiting for a phone edit or a manual reload.
	cron.schedule('*/15 * * * *', async () => {
		try {
			await syncAll();
			publishLive();
		} catch {
			/* transient; next tick retries */
		}
	});

	// Sites of Interest re-scrape every 6 hours.
	cron.schedule('0 */6 * * *', async () => {
		try {
			await refreshAllSites();
		} catch {
			/* transient */
		}
	});
}
