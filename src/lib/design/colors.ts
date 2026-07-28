import type { ProfileColor } from '$lib/types';

/** All profile colors, in swatch-picker order. */
export const PROFILE_COLORS: ProfileColor[] = [
	'pink',
	'sky',
	'sage',
	'lavender',
	'peach',
	'coral',
	'mint',
	'orchid'
];

/** Map a profile color key to its CSS custom property name. */
export const PROFILE_VAR: Record<ProfileColor, string> = {
	pink: '--color-profile-pink',
	sage: '--color-profile-sage',
	sky: '--color-profile-blue',
	lavender: '--color-profile-lavender',
	peach: '--color-profile-peach',
	coral: '--color-profile-coral',
	mint: '--color-profile-mint',
	orchid: '--color-profile-purple'
};

/** `var(--color-profile-…)` for a profile color. */
export function profileColorVar(c: ProfileColor): string {
	return `var(${PROFILE_VAR[c]})`;
}

/** A lighter tint of a profile color, mixed toward white (for pills, chips). */
export function profileTint(c: ProfileColor, pct = 45): string {
	return `color-mix(in srgb, ${profileColorVar(c)} ${pct}%, white)`;
}

/** A darker "ink" of a profile color for text/accents on a light tint. */
export function profileInk(c: ProfileColor, pct = 55): string {
	return `color-mix(in srgb, ${profileColorVar(c)} ${pct}%, #1a1a1a)`;
}
