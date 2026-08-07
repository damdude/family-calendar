import { json, error } from '@sveltejs/kit';
import { loadConfig, saveConfig } from '$lib/server/config';
import type { RequestHandler } from './$types';

/**
 * Record the first-boot choice of TV vs touchscreen, and (optionally) that the
 * family opted to set up Wi-Fi later. Kept separate from the main config POST
 * so it can be set before the rest of setup exists.
 */
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json().catch(() => ({}));
	const config = await loadConfig();

	if (body.displayMode !== undefined) {
		if (body.displayMode !== 'tv' && body.displayMode !== 'touch') {
			error(400, 'displayMode must be "tv" or "touch"');
		}
		config.displayMode = body.displayMode;
	}
	if (body.wifiSkipped !== undefined) {
		config.wifiSkipped = !!body.wifiSkipped;
	}

	await saveConfig(config);
	return json({ ok: true, displayMode: config.displayMode, wifiSkipped: config.wifiSkipped });
};
