/** Time + calendar formatting helpers. */

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "2:15 PM" (12h) or "14:15" (24h). */
export function formatClock(d: Date, clock24h = false): string {
	if (clock24h) {
		return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
	}
	const h = d.getHours() % 12 || 12;
	const m = String(d.getMinutes()).padStart(2, '0');
	const ap = d.getHours() < 12 ? 'AM' : 'PM';
	return `${h}:${m} ${ap}`;
}

/** One endpoint of a range: "10", "11:30" (meridiem added by caller). */
function partNoMeridiem(d: Date): string {
	const h = d.getHours() % 12 || 12;
	const m = d.getMinutes();
	return m === 0 ? `${h}` : `${h}:${String(m).padStart(2, '0')}`;
}

function part24(d: Date): string {
	return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function meridiem(d: Date): string {
	return d.getHours() < 12 ? 'AM' : 'PM';
}

/**
 * Compact event-time range, e.g.
 *   "10 - 11:30 AM"  (same meridiem → shown once, at the end)
 *   "11:30 AM - 1 PM" (different meridiem → shown on both)
 *   "10:00 - 11:30"   (24h)
 */
export function formatRange(start: Date, end: Date, clock24h = false): string {
	if (clock24h) return `${part24(start)} - ${part24(end)}`;
	const sM = meridiem(start);
	const eM = meridiem(end);
	if (sM === eM) return `${partNoMeridiem(start)} - ${partNoMeridiem(end)} ${eM}`;
	return `${partNoMeridiem(start)} ${sM} - ${partNoMeridiem(end)} ${eM}`;
}

/** Hour-rail label, e.g. 9 → "9 AM", 13 → "1 PM", or "13" in 24h. */
export function hourLabel(hour: number, clock24h = false): string {
	if (clock24h) return String(hour);
	const h = hour % 12 || 12;
	const ap = hour < 12 || hour === 24 ? 'AM' : 'PM';
	return `${h} ${ap}`;
}

export interface TimeSlot {
	hour: number; // fractional (e.g. 9.5 for 9:30)
	major: boolean; // on-the-hour vs the half-hour tick between
	label: string;
}

/** Weekly-grid rail slots every 30 minutes between startHour and endHour
 *  (inclusive). Half-hour ticks get a lighter sub-label, matching how
 *  dedicated calendar-hub displays mark time without doubling the label width. */
export function timeSlots(startHour: number, endHour: number, clock24h = false): TimeSlot[] {
	const slots: TimeSlot[] = [];
	for (let h = startHour; h <= endHour; h += 0.5) {
		const major = Number.isInteger(h);
		slots.push({
			hour: h,
			major,
			label: major ? hourLabel(h, clock24h) : clock24h ? `${Math.floor(h)}:30` : ':30'
		});
	}
	return slots;
}

export interface DayColumn {
	date: Date;
	label: string; // "Tue"
	dayNum: number; // 4
	isToday: boolean;
}

/** The 7 columns of the visible week, starting from `weekStart`. */
export function weekColumns(weekStart: Date, days = 7): DayColumn[] {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const cols: DayColumn[] = [];
	for (let i = 0; i < days; i++) {
		const date = new Date(weekStart);
		date.setDate(date.getDate() + i);
		date.setHours(0, 0, 0, 0);
		cols.push({
			date,
			label: DAY_LABELS[date.getDay()],
			dayNum: date.getDate(),
			isToday: date.getTime() === today.getTime()
		});
	}
	return cols;
}

/** Midnight on the Monday (weekStartsOn=1) or Sunday (0) of the given date's week. */
export function startOfWeek(base: Date, weekStartsOn: 0 | 1 = 1): Date {
	const d = new Date(base);
	d.setHours(0, 0, 0, 0);
	const dow = d.getDay();
	const diff = weekStartsOn === 1 ? (dow + 6) % 7 : dow;
	d.setDate(d.getDate() - diff);
	return d;
}

/** Whether two dates fall on the same calendar day. */
export function sameDay(a: Date, b: Date): boolean {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	);
}

/** Fractional hour of day, e.g. 10:30 → 10.5. */
export function fractionalHour(d: Date): number {
	return d.getHours() + d.getMinutes() / 60;
}

/** Whether `now` falls in the [start,end) HH:MM window (handles overnight wrap). */
export function isWithinWindow(now: Date, start: string, end: string): boolean {
	const [sh, sm] = start.split(':').map(Number);
	const [eh, em] = end.split(':').map(Number);
	const cur = now.getHours() * 60 + now.getMinutes();
	const s = sh * 60 + sm;
	const e = eh * 60 + em;
	if (s === e) return false;
	if (s < e) return cur >= s && cur < e;
	return cur >= s || cur < e; // wraps past midnight
}

/** Local date key, YYYY-MM-DD. */
export function dateKey(d = new Date()): string {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
		d.getDate()
	).padStart(2, '0')}`;
}

/** Parse a YYYY-MM-DD key as a LOCAL date (avoids UTC parsing shifts). */
export function parseDateKey(key: string): Date {
	const [y, m, d] = key.split('-').map(Number);
	return new Date(y, m - 1, d);
}

/** Whether `key` (YYYY-MM-DD) is exactly one day before `ref`. */
export function isYesterday(key: string, ref = new Date()): boolean {
	const y = new Date(ref);
	y.setDate(y.getDate() - 1);
	return key === dateKey(y);
}

/** Age in whole years from a YYYY-MM-DD date of birth. Profiles only store a
 *  point-in-time age (used for routine seeding + role), so this is computed
 *  at entry time rather than persisted as a birth date. */
export function ageFromDOB(dob: string, ref = new Date()): number {
	const born = parseDateKey(dob);
	let age = ref.getFullYear() - born.getFullYear();
	const beforeBirthday =
		ref.getMonth() < born.getMonth() ||
		(ref.getMonth() === born.getMonth() && ref.getDate() < born.getDate());
	if (beforeBirthday) age--;
	return Math.max(0, age);
}
