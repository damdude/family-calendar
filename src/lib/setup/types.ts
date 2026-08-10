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

/**
 * Whole years between a birthdate (YYYY-MM-DD) and today. Both setup wizards
 * collect a date of birth (a native date picker is far more reliable across
 * mobile browsers than a bare number field, and doesn't go stale) but the
 * stored/wire format everywhere else in the app is still a plain `age`
 * number — this is computed once at entry time rather than persisting the
 * birthdate itself, keeping the data model and server validation unchanged.
 */
export function ageFromBirthdate(birthdate: string): number {
	const dob = new Date(`${birthdate}T00:00:00`);
	if (Number.isNaN(dob.getTime())) return 0;
	const now = new Date();
	let age = now.getFullYear() - dob.getFullYear();
	const beforeBirthdayThisYear =
		now.getMonth() < dob.getMonth() ||
		(now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate());
	if (beforeBirthdayThisYear) age -= 1;
	return Math.max(0, age);
}

/** A sensible default birthdate to preselect in the picker (~8 years old). */
export function defaultBirthdate(): string {
	const d = new Date();
	d.setFullYear(d.getFullYear() - 8);
	return d.toISOString().slice(0, 10);
}

/** Today's date as YYYY-MM-DD, for capping a birthdate picker's `max`. */
export function todayDateStr(): string {
	return new Date().toISOString().slice(0, 10);
}

/**
 * An ephemeral client-side id for a draft profile — never persisted or
 * trusted server-side, just a React/Svelte-style list key. `crypto.randomUUID`
 * only exists in a secure context (HTTPS, or literally `localhost`), and the
 * pairing wizard is loaded over plain HTTP at a LAN mDNS address
 * (`http://familycalendar.local:...`), which doesn't qualify — so on real
 * phones (notably iOS Safari) that API is `undefined` and calling it throws,
 * silently aborting "Add person" with no visible feedback. This works
 * everywhere.
 */
export function randomId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
