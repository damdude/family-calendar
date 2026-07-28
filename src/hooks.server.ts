import { startScheduler } from '$lib/server/cron';

// Start background jobs (calendar sync, later: scrape, OTA) once on boot.
startScheduler();
