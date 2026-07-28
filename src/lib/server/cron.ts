/** Background schedulers (server-only). Started once from hooks.server.ts. */

import cron from 'node-cron';
import { syncGoogle } from './sync';

let started = false;

export function startScheduler(): void {
	if (started) return;
	started = true;

	// Calendar sync every 15 minutes (no-op when not connected).
	cron.schedule('*/15 * * * *', async () => {
		try {
			await syncGoogle();
		} catch {
			/* transient; next tick retries */
		}
	});
}
