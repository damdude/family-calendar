/**
 * Sites of Interest scraper (server-only).
 *
 * Fetches a per-profile URL, respects robots.txt, extracts the main content
 * with @mozilla/readability, and pulls a handful of headlines to surface on the
 * kid's profile ("News for you"). Identifies itself with a project user-agent
 * and caps response size.
 */

import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { safeFetch } from './urlSafety';

const USER_AGENT =
	process.env.SCRAPER_USER_AGENT ??
	'family-calendar/0.1 (+https://github.com/damdude/family-calendar)';
const MAX_BYTES = 2_000_000;
const TIMEOUT_MS = 12_000;

export interface ScrapeResult {
	title: string;
	excerpt: string;
	items: string[];
	fetchedAt: number;
}

/** Minimal robots.txt check for our user-agent + '*' groups. */
export async function isAllowed(url: string): Promise<boolean> {
	try {
		const u = new URL(url);
		const res = await fetchWithTimeout(`${u.origin}/robots.txt`);
		if (!res.ok) return true; // no robots → allowed
		const text = await res.text();
		const path = u.pathname || '/';

		// Collect Disallow rules from groups matching '*' or our agent token.
		let applies = false;
		const disallows: string[] = [];
		for (const raw of text.split('\n')) {
			const line = raw.split('#')[0].trim();
			if (!line) continue;
			const [field, ...rest] = line.split(':');
			const value = rest.join(':').trim();
			const key = field.trim().toLowerCase();
			if (key === 'user-agent') {
				applies = value === '*' || 'family-calendar'.includes(value.toLowerCase());
			} else if (key === 'disallow' && applies && value) {
				disallows.push(value);
			}
		}
		return !disallows.some((d) => path.startsWith(d));
	} catch {
		return true;
	}
}

async function fetchWithTimeout(url: string): Promise<Response> {
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
	try {
		return await safeFetch(url, {
			headers: { 'user-agent': USER_AGENT, accept: 'text/html' },
			signal: ctrl.signal
		});
	} finally {
		clearTimeout(t);
	}
}

/** Extract title, excerpt, and headline list from HTML. Pure + testable. */
export function extractFromHtml(html: string, url: string): ScrapeResult {
	const dom = new JSDOM(html, { url });
	const doc = dom.window.document;

	let title = doc.title || '';
	let excerpt = '';
	try {
		const article = new Readability(doc.cloneNode(true) as Document).parse();
		if (article) {
			title = article.title || title;
			excerpt = (article.excerpt || article.textContent || '').trim().slice(0, 280);
		}
	} catch {
		/* fall back to headings below */
	}

	// Headlines: prominent headings + article/nav link texts, de-duped.
	const seen = new Set<string>();
	const items: string[] = [];
	const push = (t: string | null | undefined) => {
		const s = (t ?? '').replace(/\s+/g, ' ').trim();
		if (s.length >= 8 && s.length <= 140 && !seen.has(s)) {
			seen.add(s);
			items.push(s);
		}
	};
	doc.querySelectorAll('h1, h2, h3, article a, [role="heading"]').forEach((el) => {
		if (items.length < 8) push(el.textContent);
	});

	return { title: title || url, excerpt, items: items.slice(0, 6), fetchedAt: Date.now() };
}

/** Fetch + extract a URL (robots-aware). Returns null if blocked/unreachable. */
export async function scrapeUrl(url: string): Promise<ScrapeResult | null> {
	if (!/^https?:\/\//i.test(url)) return null;
	if (!(await isAllowed(url))) return null;
	try {
		const res = await fetchWithTimeout(url);
		if (!res.ok) return null;
		const reader = res.body?.getReader();
		if (!reader) {
			const html = await res.text();
			return extractFromHtml(html.slice(0, MAX_BYTES), url);
		}
		// Cap the read at MAX_BYTES.
		let received = 0;
		const chunks: Uint8Array[] = [];
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			received += value.length;
			chunks.push(value);
			if (received > MAX_BYTES) {
				await reader.cancel();
				break;
			}
		}
		const html = Buffer.concat(chunks).toString('utf8');
		return extractFromHtml(html, url);
	} catch {
		return null;
	}
}
