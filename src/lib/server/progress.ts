/**
 * Kid-progress persistence (data/progress.json), server-only.
 * Streaks, per-day completions, and feelings check-ins. Atomic writes.
 */

import fsp from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR } from './paths';
import { atomicWriteFile } from './atomicWrite';
import { emptyProgress, type ProgressData, type RoutineProgress } from '$lib/kid/progress';
import { isYesterday, parseDateKey } from '$lib/time';

const PROGRESS_PATH = path.join(DATA_DIR, 'progress.json');

export async function loadProgress(): Promise<ProgressData> {
	try {
		const raw = JSON.parse(await fsp.readFile(PROGRESS_PATH, 'utf8'));
		return {
			routines: raw?.routines && typeof raw.routines === 'object' ? raw.routines : {},
			feelings: raw?.feelings && typeof raw.feelings === 'object' ? raw.feelings : {}
		};
	} catch {
		return emptyProgress();
	}
}

async function saveProgress(data: ProgressData): Promise<void> {
	await fsp.mkdir(DATA_DIR, { recursive: true });
	await atomicWriteFile(PROGRESS_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// A kid tapping through a routine checklist fires several concurrent calls
// into recordRoutineState below — each does its own load-mutate-save of the
// same file, so without this they can interleave and silently lose one
// another's update (classic read-modify-write race), independent of the
// atomic-write fix above (which only prevents a crash on writing, not two
// writers both reading the same stale "before" state). Confirmed on-device:
// 6 rapid taps intermittently landed as few as 2 completed steps. Chaining
// every call through this promise serializes them onto the actual file.
let progressLock: Promise<unknown> = Promise.resolve();
function withProgressLock<T>(fn: () => Promise<T>): Promise<T> {
	const run = progressLock.then(fn, fn);
	progressLock = run.catch(() => {});
	return run;
}

function ensureRoutine(data: ProgressData, routineId: number): RoutineProgress {
	if (!data.routines[routineId]) {
		data.routines[routineId] = { streakCurrent: 0, streakLongest: 0, completions: {} };
	}
	return data.routines[routineId];
}

/**
 * Record the set of completed step ids for a routine on a given date, and
 * update the streak when the routine becomes fully complete for that day.
 * `justCompleted` tells the caller whether THIS call is what pushed it over
 * the line (vs. it was already complete for today) — that's the signal to
 * award a star, so toggling steps back and forth doesn't award repeatedly.
 */
export function recordRoutineState(
	routineId: number,
	date: string,
	doneStepIds: number[],
	total: number
): Promise<RoutineProgress & { justCompleted: boolean }> {
	return withProgressLock(async () => {
		const data = await loadProgress();
		const r = ensureRoutine(data, routineId);
		r.completions[date] = doneStepIds;

		const fullyComplete = total > 0 && doneStepIds.length >= total;
		let justCompleted = false;
		if (fullyComplete && r.lastCompletedDate !== date) {
			justCompleted = true;
			if (r.lastCompletedDate && isYesterday(r.lastCompletedDate, parseDateKey(date))) {
				r.streakCurrent += 1;
			} else {
				r.streakCurrent = 1;
			}
			r.streakLongest = Math.max(r.streakLongest, r.streakCurrent);
			r.lastCompletedDate = date;
		} else if (!fullyComplete && r.lastCompletedDate === date) {
			// Unchecked a step after completing today → walk the streak back a day.
			r.streakCurrent = Math.max(0, r.streakCurrent - 1);
			r.lastCompletedDate = undefined;
		}

		await saveProgress(data);
		return { ...r, justCompleted };
	});
}

export function logFeeling(
	profileId: number,
	date: string,
	emoji: string,
	label: string
): Promise<void> {
	return withProgressLock(async () => {
		const data = await loadProgress();
		if (!data.feelings[profileId]) data.feelings[profileId] = {};
		data.feelings[profileId][date] = { emoji, label };
		await saveProgress(data);
	});
}
