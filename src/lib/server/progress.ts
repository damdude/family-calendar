/**
 * Kid-progress persistence (data/progress.json), server-only.
 * Streaks, per-day completions, and feelings check-ins. Atomic writes.
 */

import fsp from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR } from './paths';
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
	const tmp = `${PROGRESS_PATH}.tmp`;
	await fsp.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
	await fsp.rename(tmp, PROGRESS_PATH);
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
 */
export async function recordRoutineState(
	routineId: number,
	date: string,
	doneStepIds: number[],
	total: number
): Promise<RoutineProgress> {
	const data = await loadProgress();
	const r = ensureRoutine(data, routineId);
	r.completions[date] = doneStepIds;

	const fullyComplete = total > 0 && doneStepIds.length >= total;
	if (fullyComplete && r.lastCompletedDate !== date) {
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
	return r;
}

export async function logFeeling(
	profileId: number,
	date: string,
	emoji: string,
	label: string
): Promise<void> {
	const data = await loadProgress();
	if (!data.feelings[profileId]) data.feelings[profileId] = {};
	data.feelings[profileId][date] = { emoji, label };
	await saveProgress(data);
}
