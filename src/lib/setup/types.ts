/**
 * Shared setup-wizard types + constants.
 *
 * Client-safe (no server-only imports): both the phone wizard and the kiosk
 * preview import from here, and the server validates against these shapes.
 */

import type { ProfileColor } from '$lib/types';

export interface ProfileDraft {
	/** Client-side temporary id (stable within a wizard session). */
	id: string;
	name: string;
	age: number;
	color: ProfileColor;
	avatarEmoji: string;
}

export interface FamilyDraft {
	name: string;
	timezone: string;
	weekStartsOn: 0 | 1;
}

export interface SetupDraft {
	family: FamilyDraft;
	profiles: ProfileDraft[];
}

/** Events pushed from the server to the kiosk over SSE. */
export type KioskEvent =
	{ type: 'hello' } | { type: 'draft'; draft: SetupDraft } | { type: 'complete' };

/** Avatar emoji choices offered in the wizard (no photo upload until Batch 4). */
export const AVATAR_CHOICES = [
	'👩🏻',
	'👨🏻',
	'👦🏻',
	'👧🏻',
	'👶🏻',
	'🧒🏻',
	'🧑🏻',
	'👩🏽',
	'👨🏽',
	'🧑🏽',
	'👵🏻',
	'👴🏻',
	'🐣',
	'🦊',
	'🐨',
	'🦄'
] as const;

export function emptyDraft(): SetupDraft {
	return {
		family: { name: '', timezone: 'UTC', weekStartsOn: 1 },
		profiles: []
	};
}
