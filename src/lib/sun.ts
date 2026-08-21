/** Sunrise/sunset estimation, for the auto light/dark theme switch. */

export interface SunTimes {
	sunrise: Date;
	sunset: Date;
}

const RAD = Math.PI / 180;

/**
 * Approximate sunrise/sunset for a date + coordinates, using the standard
 * solar-declination (Cooper's equation) and equation-of-time formulas from
 * solar geometry. Accurate to within a few minutes, which is plenty since
 * this only drives a ±1h theme switch, not anything safety-critical.
 */
export function sunTimes(date: Date, latDeg: number, lonDeg: number): SunTimes {
	const dayStart = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
	const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
	const dayOfYear = Math.round((dayStart - yearStart) / 86_400_000) + 1;

	// Solar declination (degrees) — how far the sun sits north/south of the
	// equator today.
	const declDeg = 23.45 * Math.sin(RAD * ((360 / 365) * (284 + dayOfYear)));

	// Equation of time (minutes) — the sundial-vs-clock drift from Earth's
	// elliptical orbit and axial tilt.
	const b = RAD * ((360 / 365) * (dayOfYear - 81));
	const eqTimeMin = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);

	// Hour angle at the horizon, factoring in atmospheric refraction and the
	// sun's apparent radius (the standard -0.833° horizon offset).
	const lat = RAD * latDeg;
	const decl = RAD * declDeg;
	const cosHourAngle =
		(Math.sin(RAD * -0.833) - Math.sin(lat) * Math.sin(decl)) / (Math.cos(lat) * Math.cos(decl));
	const hourAngleDeg = Math.acos(Math.min(1, Math.max(-1, cosHourAngle))) / RAD;

	// Solar noon (UTC hours) = clock noon at this longitude, corrected for
	// the equation of time.
	const solarNoonUtcHours = 12 - lonDeg / 15 - eqTimeMin / 60;
	const sunriseUtcHours = solarNoonUtcHours - hourAngleDeg / 15;
	const sunsetUtcHours = solarNoonUtcHours + hourAngleDeg / 15;

	return {
		sunrise: new Date(dayStart + sunriseUtcHours * 3_600_000),
		sunset: new Date(dayStart + sunsetUtcHours * 3_600_000)
	};
}

/** Default coordinates for the auto theme when the family hasn't set a
 *  precise location — reasonable enough for a ±1h sunrise/sunset window. */
export const DEFAULT_LAT = 34.0522;
export const DEFAULT_LON = -118.2437;

/** Whether `now` falls in the dark window: from 1h after sunset to 1h before
 *  the next sunrise. */
export function isDarkNow(now: Date, lat = DEFAULT_LAT, lon = DEFAULT_LON): boolean {
	const { sunrise, sunset } = sunTimes(now, lat, lon);
	const HOUR = 3_600_000;
	return now.getTime() < sunrise.getTime() - HOUR || now.getTime() >= sunset.getTime() + HOUR;
}
