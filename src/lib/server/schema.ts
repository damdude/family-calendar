/**
 * Zod schemas for validating persisted config and wizard payloads.
 * Server-only. Untrusted input (the phone wizard) is always parsed through
 * these before it touches disk.
 */

import { z } from 'zod';

export const ProfileColorSchema = z.enum([
	'pink',
	'sage',
	'sky',
	'lavender',
	'peach',
	'coral',
	'mint',
	'orchid'
]);

export const ProfileDraftSchema = z.object({
	id: z.string().min(1).max(64),
	name: z.string().trim().min(1).max(40),
	age: z.number().int().min(0).max(120),
	color: ProfileColorSchema,
	avatarEmoji: z.string().min(1).max(8)
});

export const FamilyDraftSchema = z.object({
	name: z.string().trim().min(1).max(60),
	timezone: z.string().min(1).max(64),
	weekStartsOn: z.union([z.literal(0), z.literal(1)])
});

export const SetupDraftSchema = z.object({
	family: FamilyDraftSchema,
	profiles: z.array(ProfileDraftSchema).max(12)
});

/**
 * The persisted config's family field, before the wizard has necessarily run —
 * unlike FamilyDraftSchema (what the wizard submits, where a name IS required),
 * this has to accept "" because config.json can legitimately be saved mid-setup
 * with no family name yet (e.g. picking TV/touch mode saves before the wizard
 * ever runs). `setupComplete` is the real "is this fully configured" flag, not
 * a non-empty name.
 */
const PersistedFamilySchema = z.object({
	name: z.string().trim().max(60),
	timezone: z.string().min(1).max(64),
	weekStartsOn: z.union([z.literal(0), z.literal(1)]),
	// Optional — drives the sunrise/sunset calculation for the auto light/dark
	// theme. Falls back to a reasonable default (src/lib/sun.ts) when unset.
	latitude: z.number().min(-90).max(90).optional(),
	longitude: z.number().min(-180).max(180).optional(),
	// Human-readable "City, State" from the location picker's geocoding
	// result — display only, never used for calculation (latitude/longitude
	// are the source of truth for sunrise/sunset).
	locationName: z.string().max(120).optional(),
	/** Shared/household addresses (a family alias, a shared inbox, …) — an
	 *  invite sent to one of these means the event is for everyone, not any
	 *  one person. See Profile.emails for the per-person equivalent. */
	sharedEmails: z
		.array(z.string().trim().toLowerCase().max(254))
		.max(10)
		.default([])
});

// --- Persisted app config ---

const FeatureFlagsSchema = z
	.object({
		calendar: z.boolean().default(true),
		lists: z.boolean().default(true),
		tasks: z.boolean().default(true),
		rewards: z.boolean().default(true),
		meals: z.boolean().default(true),
		recipes: z.boolean().default(true),
		photos: z.boolean().default(true),
		sleep: z.boolean().default(true),
		routines: z.boolean().default(true),
		feelings: z.boolean().default(true),
		sitesOfInterest: z.boolean().default(true)
	})
	.prefault({});

const ViewPrefsSchema = z
	.object({
		dayStartHour: z.number().int().min(0).max(23).default(6),
		dayEndHour: z.number().int().min(1).max(24).default(21),
		weekStartsOn: z.union([z.literal(0), z.literal(1)]).default(1),
		clock24h: z.boolean().default(false),
		orientation: z.enum(['auto', 'landscape', 'portrait']).default('auto')
	})
	.prefault({});

const SleepWindowSchema = z
	.object({
		start: z.string().default('21:00'),
		end: z.string().default('06:30'),
		enabled: z.boolean().default(true)
	})
	.prefault({});

const VestaboardSchema = z
	.object({
		/** Rotating custom messages (welcome, happy birthday, …). */
		messages: z.array(z.string().max(120)).max(20).default([]),
		showWeather: z.boolean().default(true),
		showEvents: z.boolean().default(true),
		showJokes: z.boolean().default(true),
		showKids: z.boolean().default(true),
		showNews: z.boolean().default(true),
		showBirthdays: z.boolean().default(true),
		/** Seconds each board is held before flipping to the next. */
		holdSeconds: z.number().int().min(4).max(120).default(12)
	})
	.prefault({});

const ScreensaverSchema = z
	.object({
		enabled: z.boolean().default(true),
		// Vestaboard is now its own full-screen mode (not a screensaver style);
		// coerce any legacy stored value back to 'clock'.
		mode: z.enum(['clock', 'photos']).catch('clock').default('clock'),
		idleMinutes: z.number().int().min(0).max(240).default(10),
		vestaboard: VestaboardSchema
	})
	.prefault({});

const KioskPrefsSchema = z
	.object({
		readOnly: z.boolean().default(false),
		parentalLock: z.boolean().default(false)
	})
	.prefault({});

const UpdatePrefsSchema = z
	.object({
		paused: z.boolean().default(false),
		intervalHours: z.number().int().min(1).max(168).default(4)
	})
	.prefault({});

export const AppConfigSchema = z
	.object({
		features: FeatureFlagsSchema,
		view: ViewPrefsSchema,
		sleep: SleepWindowSchema,
		screensaver: ScreensaverSchema,
		kiosk: KioskPrefsSchema,
		updates: UpdatePrefsSchema,
		celebrations: z.boolean().default(true)
	})
	.prefault({});

export const PersistedProfileSchema = z.object({
	id: z.number().int(),
	name: z.string().trim().min(1).max(40),
	nickname: z.string().max(40).optional(),
	age: z.number().int().min(0).max(120),
	role: z.enum(['parent', 'child']),
	color: ProfileColorSchema,
	avatarEmoji: z.string().min(1).max(8),
	/** Addresses that identify this person on a synced calendar invite —
	 *  matched against ATTENDEE lines to auto-tag events by who's actually
	 *  invited, not who organized it or whose name happens to be in the
	 *  title. See PersistedFamilySchema.sharedEmails for the whole-family
	 *  equivalent. */
	emails: z
		.array(z.string().trim().toLowerCase().max(254))
		.max(5)
		.default([]),
	/** Set when the profile has an uploaded (encrypted) photo; cache-buster. */
	photoUpdatedAt: z.number().optional(),
	/** Whether this profile follows morning/evening routines. Adults default
	 *  off (routines are seeded only for children); kids default on. */
	routinesEnabled: z.boolean().optional()
});

export const PersistedConfigSchema = z.object({
	setupComplete: z.boolean().default(false),
	/** 'tv' | 'touch', null until the first-boot mode picker runs. */
	displayMode: z.enum(['tv', 'touch']).nullable().default(null),
	/** The family chose "set up Wi-Fi later". */
	wifiSkipped: z.boolean().default(false),
	family: PersistedFamilySchema.default({
		name: '',
		timezone: 'UTC',
		weekStartsOn: 1,
		sharedEmails: []
	}),
	profiles: z.array(PersistedProfileSchema).default([]),
	app: AppConfigSchema
});

export type PersistedConfig = z.infer<typeof PersistedConfigSchema>;
export type PersistedProfile = z.infer<typeof PersistedProfileSchema>;
