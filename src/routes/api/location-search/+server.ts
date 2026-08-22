import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface GeocodingResult {
	name: string;
	admin1?: string; // state/region
	country?: string;
	latitude: number;
	longitude: number;
	timezone: string;
}

/** Search for a place by name — returns candidates with coordinates and the
 *  IANA timezone for each, so picking one sets both location and timezone
 *  in a single step. Free, no API key: Open-Meteo's geocoding API. */
export const GET: RequestHandler = async ({ url, fetch }) => {
	const q = url.searchParams.get('q')?.trim();
	if (!q || q.length < 2) return json({ results: [] });

	try {
		const r = await fetch(
			`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=en&format=json`
		);
		if (!r.ok) throw error(502, 'location search failed');
		const data = (await r.json()) as { results?: GeocodingResult[] };
		return json({
			results: (data.results ?? []).map((p) => ({
				name: p.name,
				admin1: p.admin1,
				country: p.country,
				latitude: p.latitude,
				longitude: p.longitude,
				timezone: p.timezone
			}))
		});
	} catch {
		throw error(502, 'location search failed — check the device is online');
	}
};
