/**
 * App configuration.
 *
 * Per ADR-002 every feature is a toggle. In production this is loaded from
 * config.json (non-sensitive) written by the setup wizard (Batch 2). For the
 * mockups we ship a sensible default with everything enabled.
 *
 * A disabled feature is *absent* from navigation — not hidden with CSS.
 */

import type { Feeling, ProfileColor, ProfileRole } from '$lib/types';

/** Default "Today's Feelings" palette (configurable per family). */
export const defaultFeelings: Feeling[] = [
	{ emoji: '🤩', label: 'Excited' },
	{ emoji: '😌', label: 'Calm' },
	{ emoji: '😢', label: 'Sad' },
	{ emoji: '😠', label: 'Angry' },
	{ emoji: '🤪', label: 'Silly' },
	{ emoji: '😊', label: 'Happy' }
];

export interface FeatureFlags {
	calendar: boolean;
	lists: boolean;
	tasks: boolean;
	rewards: boolean;
	meals: boolean;
	recipes: boolean;
	photos: boolean;
	sleep: boolean;
	/** Kid routines + celebration surfaces. */
	routines: boolean;
	/** Today's Feelings emoji check-ins. */
	feelings: boolean;
	/** Per-profile URL feeds. */
	sitesOfInterest: boolean;
}

export type Orientation = 'landscape' | 'portrait';

export interface ViewPrefs {
	/** First hour shown on the weekly grid (0–23). */
	dayStartHour: number;
	/** Last hour shown on the weekly grid (0–23). */
	dayEndHour: number;
	weekStartsOn: 0 | 1; // 0 = Sunday, 1 = Monday
	/** Use 24-hour clock in the top bar and grid. */
	clock24h: boolean;
	/** Display mounting orientation — drives the app shell layout. */
	orientation: Orientation;
}

export interface SleepWindow {
	/** "HH:MM" 24h — screensaver/sleep mode engages. */
	start: string;
	/** "HH:MM" 24h — dashboard wakes. */
	end: string;
	enabled: boolean;
}

export interface AppConfig {
	features: FeatureFlags;
	view: ViewPrefs;
	sleep: SleepWindow;
	/** Master switch for celebration animations (confetti, star bursts). */
	celebrations: boolean;
}

/**
 * Client-safe shape of the persisted config.json (mirrors the server Zod
 * schema in src/lib/server/schema.ts). Defined here so the client store can
 * apply persisted config without importing server-only code.
 */
export interface PersistedFamily {
	name: string;
	timezone: string;
	weekStartsOn: 0 | 1;
}
export interface PersistedProfileMeta {
	id: number;
	name: string;
	nickname?: string;
	age: number;
	role: ProfileRole;
	color: ProfileColor;
	avatarEmoji: string;
	photoUpdatedAt?: number;
}
export interface PersistedConfigShape {
	setupComplete: boolean;
	family: PersistedFamily;
	profiles: PersistedProfileMeta[];
	app: AppConfig;
}

export const defaultConfig: AppConfig = {
	features: {
		calendar: true,
		lists: true,
		tasks: true,
		rewards: true,
		meals: true,
		recipes: true,
		photos: true,
		sleep: true,
		routines: true,
		feelings: true,
		sitesOfInterest: true
	},
	view: {
		dayStartHour: 9,
		dayEndHour: 17,
		weekStartsOn: 1,
		clock24h: false,
		orientation: 'landscape'
	},
	sleep: {
		start: '21:00',
		end: '06:30',
		enabled: true
	},
	celebrations: true
};
