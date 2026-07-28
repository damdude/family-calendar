/**
 * Universal calendar subscriptions via iCal (ICS/webcal) links. Server-only.
 *
 * Works with any standards-compliant calendar that exposes a subscribe URL:
 * Google Calendar (its "Secret address in iCal format"), Apple iCloud
 * (published/public calendar → webcal link), Outlook (published ICS), etc.
 *
 * Fetches the feed, parses it (node-ical), and expands recurring events into
 * concrete occurrences within a window.
 */

import ical from 'node-ical';

const USER_AGENT =
	process.env.SCRAPER_USER_AGENT ??
	'family-calendar/0.1 (+https://github.com/damdude/family-calendar)';
const MAX_BYTES = 5_000_000;
const TIMEOUT_MS = 15_000;

export interface IcsEvent {
	externalId: string;
	startTs: number; // unix seconds
	endTs: number;
	allDay: boolean;
	title: string;
	description?: string;
	location?: string;
}

/** Normalize webcal:// to https:// (browsers/servers can't fetch webcal). */
export function normalizeIcsUrl(url: string): string {
	return url.replace(/^webcal:\/\//i, 'https://').trim();
}

async function fetchText(url: string): Promise<string> {
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
	try {
		const res = await fetch(url, {
			headers: { 'user-agent': USER_AGENT, accept: 'text/calendar,text/plain,*/*' },
			signal: ctrl.signal,
			redirect: 'follow'
		});
		if (!res.ok) throw new Error(`ICS fetch failed: ${res.status}`);
		const buf = Buffer.from(await res.arrayBuffer());
		return buf.subarray(0, MAX_BYTES).toString('utf8');
	} finally {
		clearTimeout(t);
	}
}

function toSec(d: Date): number {
	return Math.floor(d.getTime() / 1000);
}

// node-ical types are loose; treat parsed components structurally.
type VEvent = {
	type?: string;
	uid?: string;
	summary?: string;
	location?: string;
	description?: string;
	start?: Date & { dateOnly?: boolean };
	end?: Date & { dateOnly?: boolean };
	datetype?: string;
	rrule?: { between: (a: Date, b: Date, inc?: boolean) => Date[] };
	recurrences?: Record<string, VEvent>;
	exdate?: Record<string, Date>;
};

/** Parse ICS text into concrete occurrences within [windowStart, windowEnd]. */
export function parseIcs(text: string, windowStart: Date, windowEnd: Date): IcsEvent[] {
	const data = ical.parseICS(text) as Record<string, VEvent>;
	const out: IcsEvent[] = [];

	for (const key of Object.keys(data)) {
		const ev = data[key];
		if (!ev || ev.type !== 'VEVENT' || !ev.start) continue;

		const allDay = ev.datetype === 'date' || !!ev.start.dateOnly;
		const duration = (ev.end?.getTime() ?? ev.start.getTime() + 3_600_000) - ev.start.getTime();
		const uid = ev.uid ?? key;
		const title = ev.summary ?? '(untitled)';

		if (ev.rrule) {
			const occurrences = ev.rrule.between(windowStart, windowEnd, true);
			for (const occ of occurrences) {
				const dk = occ.toISOString().slice(0, 10);
				if (ev.exdate && ev.exdate[dk]) continue; // cancelled instance
				const override = ev.recurrences?.[dk];
				const start = override?.start ?? occ;
				const end = override?.end ?? new Date(occ.getTime() + duration);
				out.push({
					externalId: `${uid}-${toSec(start)}`,
					startTs: toSec(start),
					endTs: toSec(end),
					allDay,
					title: override?.summary ?? title,
					description: override?.description ?? ev.description,
					location: override?.location ?? ev.location
				});
			}
		} else {
			if (ev.end && ev.end < windowStart) continue;
			if (ev.start > windowEnd) continue;
			out.push({
				externalId: uid,
				startTs: toSec(ev.start),
				endTs: toSec(ev.end ?? new Date(ev.start.getTime() + duration)),
				allDay,
				title,
				description: ev.description,
				location: ev.location
			});
		}
	}
	return out;
}

/** Fetch + parse an ICS subscription within a window. */
export async function fetchIcsEvents(
	url: string,
	windowStart: Date,
	windowEnd: Date
): Promise<IcsEvent[]> {
	const text = await fetchText(normalizeIcsUrl(url));
	return parseIcs(text, windowStart, windowEnd);
}
