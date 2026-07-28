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
		dayStartHour: z.number().int().min(0).max(23).default(9),
		dayEndHour: z.number().int().min(1).max(24).default(17),
		weekStartsOn: z.union([z.literal(0), z.literal(1)]).default(1),
		clock24h: z.boolean().default(false),
		orientation: z.enum(['landscape', 'portrait']).default('landscape')
	})
	.prefault({});

const SleepWindowSchema = z
	.object({
		start: z.string().default('21:00'),
		end: z.string().default('06:30'),
		enabled: z.boolean().default(true)
	})
	.prefault({});

const ScreensaverSchema = z
	.object({
		enabled: z.boolean().default(true),
		mode: z.enum(['clock', 'photos']).default('clock'),
		idleMinutes: z.number().int().min(0).max(240).default(10)
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
	/** Set when the profile has an uploaded (encrypted) photo; cache-buster. */
	photoUpdatedAt: z.number().optional()
});

export const PersistedConfigSchema = z.object({
	setupComplete: z.boolean().default(false),
	family: FamilyDraftSchema.default({ name: '', timezone: 'UTC', weekStartsOn: 1 }),
	profiles: z.array(PersistedProfileSchema).default([]),
	app: AppConfigSchema
});

export type PersistedConfig = z.infer<typeof PersistedConfigSchema>;
export type PersistedProfile = z.infer<typeof PersistedProfileSchema>;
