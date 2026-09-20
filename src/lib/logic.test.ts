import { describe, it, expect } from 'vitest';
import { isWithinWindow } from './time';
import { choreStatsFor } from './server/familydata';
import { normalizeIcsUrl } from './server/ical';

const at = (h: number, m = 0) => new Date(2026, 0, 15, h, m);

describe('isWithinWindow (sleep schedule)', () => {
	it('handles a window inside one day', () => {
		expect(isWithinWindow(at(13), '09:00', '17:00')).toBe(true);
		expect(isWithinWindow(at(8, 59), '09:00', '17:00')).toBe(false);
		expect(isWithinWindow(at(17), '09:00', '17:00')).toBe(false); // end is exclusive
		expect(isWithinWindow(at(9), '09:00', '17:00')).toBe(true); // start is inclusive
	});

	it('wraps past midnight — the real default is 21:00 to 06:30', () => {
		expect(isWithinWindow(at(22), '21:00', '06:30')).toBe(true);
		expect(isWithinWindow(at(2), '21:00', '06:30')).toBe(true);
		expect(isWithinWindow(at(6, 29), '21:00', '06:30')).toBe(true);
		expect(isWithinWindow(at(6, 30), '21:00', '06:30')).toBe(false);
		expect(isWithinWindow(at(12), '21:00', '06:30')).toBe(false);
		expect(isWithinWindow(at(20, 59), '21:00', '06:30')).toBe(false);
	});

	it('treats an empty window (start === end) as never active', () => {
		expect(isWithinWindow(at(9), '09:00', '09:00')).toBe(false);
		expect(isWithinWindow(at(3), '09:00', '09:00')).toBe(false);
	});
});

describe('choreStatsFor', () => {
	const chore = (o: Partial<Record<string, unknown>>) =>
		({
			id: 1,
			name: 'c',
			icon: '',
			starReward: 0,
			frequency: 'daily',
			completed: false,
			...o
		}) as never;

	it('counts only the requested profile', () => {
		const chores = [
			chore({ id: 1, assignedTo: 1, completed: true, starReward: 5 }),
			chore({ id: 2, assignedTo: 2, completed: true, starReward: 99 }),
			chore({ id: 3, assignedTo: 1, completed: false, starReward: 7 })
		];
		const s = choreStatsFor(chores, 1);
		expect(s.totalClaimed).toBe(2);
		expect(s.totalCompleted).toBe(1);
		expect(s.totalStarsEarned).toBe(5); // only completed chores pay out
		expect(s.completionRate).toBe(50);
	});

	it('does not divide by zero when nothing is claimed', () => {
		const s = choreStatsFor([], 1);
		expect(s).toEqual({
			totalClaimed: 0,
			totalCompleted: 0,
			completionRate: 0,
			totalStarsEarned: 0
		});
	});

	it('ignores unassigned chores', () => {
		const s = choreStatsFor([chore({ assignedTo: undefined, completed: true, starReward: 3 })], 1);
		expect(s.totalClaimed).toBe(0);
		expect(s.totalStarsEarned).toBe(0);
	});
});

describe('normalizeIcsUrl', () => {
	it('rewrites webcal to https', () => {
		expect(normalizeIcsUrl('webcal://example.com/a.ics')).toBe('https://example.com/a.ics');
		expect(normalizeIcsUrl('WEBCAL://example.com/a.ics')).toBe('https://example.com/a.ics');
	});

	it('leaves http/https alone and trims', () => {
		expect(normalizeIcsUrl('  https://example.com/a.ics  ')).toBe('https://example.com/a.ics');
		expect(normalizeIcsUrl('http://example.com/a.ics')).toBe('http://example.com/a.ics');
	});
});
