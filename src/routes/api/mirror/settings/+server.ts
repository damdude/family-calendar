import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { isMirrorToken } from '$lib/server/mirror';
import { loadConfig, saveConfig } from '$lib/server/config';
import { publishLive } from '$lib/server/live';
import type { RequestHandler } from './$types';

const Body = z.object({
	token: z.string(),
	familyName: z.string().trim().max(60).optional(),
	latitude: z.number().min(-90).max(90).optional(),
	longitude: z.number().min(-180).max(180).optional(),
	timezone: z.string().min(1).max(64).optional(),
	locationName: z.string().max(120).optional()
});

/** Phone companion → server: family name / location / timezone. */
export const POST: RequestHandler = async ({ request }) => {
	const parsed = Body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, 'invalid settings');
	if (!isMirrorToken(parsed.data.token)) throw error(410, 'session expired');

	const { familyName, latitude, longitude, timezone, locationName } = parsed.data;
	const config = await loadConfig();
	if (familyName !== undefined) config.family.name = familyName;
	if (latitude !== undefined) config.family.latitude = latitude;
	if (longitude !== undefined) config.family.longitude = longitude;
	if (timezone !== undefined) config.family.timezone = timezone;
	if (locationName !== undefined) config.family.locationName = locationName;

	await saveConfig(config);
	publishLive();
	return json({ ok: true });
};
