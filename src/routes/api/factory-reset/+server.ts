import { error, json } from '@sveltejs/kit';
import { loadConfig, saveConfig } from '$lib/server/config';
import { getDb } from '$lib/server/db';
import type { RequestHandler } from './$types';

/**
 * Factory reset: clears all setup, family data, and credentials.
 * WARNING: This is destructive and cannot be undone without restoring from backup.
 * Only available after setup is complete (as a safety measure).
 */
export const POST: RequestHandler = async ({ request }) => {
	// Require a confirmation token in the request body to prevent accidental resets
	const body = await request.json().catch(() => null);
	if (body?.confirm !== 'FACTORY_RESET_CONFIRM') {
		throw error(400, 'Factory reset requires confirmation');
	}

	try {
		const db = getDb();

		// Clear all tables
		db.exec(`
			DELETE FROM oauth_tokens;
			DELETE FROM notifications;
			DELETE FROM photos;
			DELETE FROM reward_claims;
			DELETE FROM chores;
			DELETE FROM events;
			DELETE FROM meals;
			DELETE FROM sites;
		`);

		// Reset configuration to initial state
		const config = await loadConfig();
		await saveConfig({
			...config,
			setupComplete: false,
			displayMode: null,
			wifiSkipped: false,
			family: {
				name: '',
				sharedEmails: []
			},
			profiles: []
		});

		return json({
			ok: true,
			message: 'Factory reset complete. Setup wizard will appear on next reload.'
		});
	} catch (err) {
		console.error('Factory reset failed:', err);
		throw error(500, 'Factory reset failed');
	}
};
