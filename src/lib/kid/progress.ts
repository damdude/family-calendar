/**
 * Kid-progress shapes (client-safe). Persisted to data/progress.json by the
 * server; hydrated into the store so streaks, completions, and feelings survive
 * reloads. Sensitive by nature but stays on-device (gitignored).
 */

export interface RoutineProgress {
	streakCurrent: number;
	streakLongest: number;
	/** YYYY-MM-DD of the last day the routine was fully completed. */
	lastCompletedDate?: string;
	/** date (YYYY-MM-DD) → step ids completed that day. */
	completions: Record<string, number[]>;
}

export interface FeelingEntry {
	emoji: string;
	label: string;
}

export interface ProgressData {
	/** routineId → progress. */
	routines: Record<number, RoutineProgress>;
	/** profileId → (date → feeling). */
	feelings: Record<number, Record<string, FeelingEntry>>;
}

export function emptyProgress(): ProgressData {
	return { routines: {}, feelings: {} };
}
