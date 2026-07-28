/** Background schedulers (server-only). Started once from hooks.server.ts. */

import cron from 'node-cron';
import { syncAll } from './sync';
import { refreshAllSites } from './sites';

let started = false;

export function startScheduler(): void {
	if (started) return;
	started = true;

	// Calendar sync (Google + ICS links) every 15 minutes (no-op when none).
	cron.schedule('*/15 * * * *', async () => {
		try {
			await syncAll();
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
