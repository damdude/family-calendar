import { error, json } from '@sveltejs/kit';
import { loadConfig } from '$lib/server/config';
import type { RequestHandler } from './$types';

/** WMO weather code → emoji + short label (Open-Meteo's `current.weather_code`).
 *  https://open-meteo.com/en/docs — grouped to the ranges they document. */
function describeCode(code: number): { icon: string; condition: string } {
	if (code === 0) return { icon: '☀️', condition: 'Clear' };
	if (code <= 2) return { icon: '🌤️', condition: 'Partly cloudy' };
	if (code === 3) return { icon: '☁️', condition: 'Overcast' };
	if (code === 45 || code === 48) return { icon: '🌫️', condition: 'Fog' };
	if (code >= 51 && code <= 57) return { icon: '🌦️', condition: 'Drizzle' };
	if (code >= 61 && code <= 67) return { icon: '🌧️', condition: 'Rain' };
	if (code >= 71 && code <= 77) return { icon: '🌨️', condition: 'Snow' };
	if (code >= 80 && code <= 82) return { icon: '🌦️', condition: 'Rain showers' };
	if (code >= 85 && code <= 86) return { icon: '🌨️', condition: 'Snow showers' };
	if (code >= 95) return { icon: '⛈️', condition: 'Thunderstorm' };
	return { icon: '🌡️', condition: 'Unknown' };
}

/** Current weather at the family's configured location. Free, no API key:
 *  Open-Meteo's forecast API (same provider as the location search). */
export const GET: RequestHandler = async ({ fetch }) => {
	const config = await loadConfig();
	const { latitude, longitude } = config.family;
	if (latitude === undefined || longitude === undefined) {
		return json({ tempF: 0, condition: 'Unavailable', icon: '—' });
	}

	try {
		const r = await fetch(
			`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`
		);
		if (!r.ok) throw error(502, 'weather fetch failed');
		const data = (await r.json()) as {
			current?: { temperature_2m?: number; weather_code?: number };
		};
		const tempF = data.current?.temperature_2m;
		const code = data.current?.weather_code;
		if (tempF === undefined || code === undefined) throw error(502, 'weather fetch failed');
		const { icon, condition } = describeCode(code);
		return json({ tempF: Math.round(tempF), condition, icon });
	} catch {
		return json({ tempF: 0, condition: 'Unavailable', icon: '—' });
	}
};
