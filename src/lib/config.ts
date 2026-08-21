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

/** 'auto' detects the real screen orientation at runtime; the other two force it
 *  (an escape hatch for hardware that doesn't report a rotated viewport). */
export type Orientation = 'auto' | 'landscape' | 'portrait';

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

export type ScreensaverMode = 'clock' | 'photos';

/** Split-flap "Vestaboard" board settings (its own full-screen mode). */
export interface VestaboardPrefs {
	/** Rotating custom messages (welcome, happy birthday, …). */
	messages: string[];
	showWeather: boolean;
	showEvents: boolean;
	showJokes: boolean;
	showKids: boolean;
	showNews: boolean;
	/** Seconds each board is held before flipping to the next. */
	holdSeconds: number;
}

export interface ScreensaverPrefs {
	enabled: boolean;
	mode: ScreensaverMode;
	/** Minutes of inactivity before the screensaver appears (0 = only in sleep window). */
	idleMinutes: number;
	vestaboard: VestaboardPrefs;
}

export interface KioskPrefs {
	/** Read-only TV mode: the display shows everything but editing is disabled
	 *  (edits happen from a paired phone). */
	readOnly: boolean;
	/** Require the admin PIN to open Settings. */
	parentalLock: boolean;
}

export interface UpdatePrefs {
	/** Pause automatic OTA updates. */
	paused: boolean;
	/** How often the update timer checks (hours). */
	intervalHours: number;
}

export interface AppConfig {
	features: FeatureFlags;
	view: ViewPrefs;
	sleep: SleepWindow;
	screensaver: ScreensaverPrefs;
	kiosk: KioskPrefs;
	updates: UpdatePrefs;
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
	/** Drives the sunrise/sunset auto theme (src/lib/sun.ts); optional. */
	latitude?: number;
	longitude?: number;
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
	/** Whether this profile follows morning/evening routines. Undefined defers
	 *  to the role-based default (children on, adults off). */
	routinesEnabled?: boolean;
}
/**
 * How this device is used. Chosen on the very first boot, before anything else,
 * because it changes how the rest of setup is driven:
 *  - 'tv'    — no touch input: Wi-Fi and data entry happen from a phone (QR).
 *  - 'touch' — a touchscreen: everything can be done on the device itself.
 * `null` means the choice hasn't been made yet.
 */
export type DisplayMode = 'tv' | 'touch';

export interface PersistedConfigShape {
	setupComplete: boolean;
	/** null until the first-boot mode picker runs. */
	displayMode: DisplayMode | null;
	/** The family chose "set up Wi-Fi later" — don't block setup on it. */
	wifiSkipped: boolean;
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
		dayStartHour: 6,
		dayEndHour: 21,
		weekStartsOn: 1,
		clock24h: false,
		orientation: 'auto'
	},
	sleep: {
		start: '21:00',
		end: '06:30',
		enabled: true
	},
	screensaver: {
		enabled: true,
		mode: 'clock',
		idleMinutes: 10,
		vestaboard: {
			messages: [],
			showWeather: true,
			showEvents: true,
			showJokes: true,
			showKids: true,
			showNews: true,
			holdSeconds: 12
		}
	},
	kiosk: {
		readOnly: false,
		parentalLock: false
	},
	updates: {
		paused: false,
		intervalHours: 4
	},
	celebrations: true
};
