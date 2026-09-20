/**
 * Display names for every feature flag, in sidebar order.
 *
 * Single source of truth: typing this as `Record<keyof FeatureFlags, string>`
 * makes TypeScript fail the build if a flag is added to `FeatureFlags` without
 * a label here. A previous copy of this map lived in the phone-remote page and
 * silently went stale, which is why the Chores toggle never appeared there.
 */

import type { FeatureFlags } from '$lib/config';

export const FEATURE_LABELS: Record<keyof FeatureFlags, string> = {
	calendar: 'Calendar',
	lists: 'Lists',
	tasks: 'Tasks',
	chores: 'Chores',
	routines: 'Kid routines',
	rewards: 'Rewards',
	meals: 'Meal planning',
	recipes: 'Recipes',
	photos: 'Photos',
	sleep: 'Sleep mode',
	feelings: "Today's Feelings",
	sitesOfInterest: 'Sites of Interest'
};

export const FEATURE_KEYS = Object.keys(FEATURE_LABELS) as (keyof FeatureFlags)[];
