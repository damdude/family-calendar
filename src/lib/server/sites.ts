/**
 * Sites of Interest storage + refresh (server-only).
 * Per-profile URL feeds with a cached extract, in data/sites.json. Content is
 * public web headlines (not PII), so it's stored plainly; the scraper caps size
 * and respects robots.txt.
 */

import fsp from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR } from './paths';
import { atomicWriteFile } from './atomicWrite';
import { scrapeUrl } from './scraper';

export interface SiteEntry {
	id: number;
	url: string;
	name: string;
	lastFetched?: number;
	title?: string;
	excerpt?: string;
	items?: string[];
}

/** profileId → entries */
type SitesData = Record<number, SiteEntry[]>;

const FILE = path.join(DATA_DIR, 'sites.json');

async function load(): Promise<SitesData> {
	try {
		return JSON.parse(await fsp.readFile(FILE, 'utf8'));
	} catch {
		return {};
	}
}

async function save(data: SitesData): Promise<void> {
	await fsp.mkdir(DATA_DIR, { recursive: true });
	await atomicWriteFile(FILE, JSON.stringify(data, null, 2), 'utf8');
}

export async function getSites(profileId?: number): Promise<SitesData> {
	const data = await load();
	if (profileId === undefined) return data;
	return { [profileId]: data[profileId] ?? [] };
}

export async function addSite(profileId: number, url: string, name: string): Promise<SiteEntry> {
	const data = await load();
	const list = (data[profileId] ??= []);
	const id = list.reduce((m, s) => Math.max(m, s.id), 0) + 1;
	const entry: SiteEntry = { id, url, name: name || new URL(url).hostname };
	list.push(entry);
	await save(data);
	// Best-effort first scrape.
	const scraped = await scrapeUrl(url);
	if (scraped) Object.assign(entry, scraped);
	await save(data);
	return entry;
}

export async function removeSite(profileId: number, id: number): Promise<void> {
	const data = await load();
	if (data[profileId]) data[profileId] = data[profileId].filter((s) => s.id !== id);
	await save(data);
}

/** Re-scrape every site (called from cron). Returns how many were refreshed. */
export async function refreshAllSites(): Promise<number> {
	const data = await load();
	let n = 0;
	for (const list of Object.values(data)) {
		for (const entry of list) {
			const scraped = await scrapeUrl(entry.url);
			if (scraped) {
				Object.assign(entry, scraped);
				n += 1;
			}
		}
	}
	await save(data);
	return n;
}
