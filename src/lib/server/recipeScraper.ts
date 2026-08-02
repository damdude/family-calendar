/**
 * Recipe scraper (server-only). Most recipe sites embed a schema.org/Recipe as
 * JSON-LD; we parse that first (name, image, ingredients, steps), and fall back
 * to a Readability extract when there's no structured data. Robots-aware via the
 * existing site scraper's checker.
 */

import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { isAllowed } from './scraper';

// Recipe sites commonly 403 non-browser agents, so identify as a normal
// browser (we still honour robots '*' disallow rules via isAllowed()).
const USER_AGENT =
	process.env.SCRAPER_USER_AGENT ??
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const MAX_BYTES = 3_000_000;
const TIMEOUT_MS = 12_000;

export interface ScrapedRecipe {
	name: string;
	image?: string;
	ingredients: string[];
	steps: string[];
	sourceUrl: string;
}

async function fetchHtml(url: string): Promise<string | null> {
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
	try {
		const res = await fetch(url, {
			headers: { 'user-agent': USER_AGENT, accept: 'text/html' },
			signal: ctrl.signal,
			redirect: 'follow'
		});
		if (!res.ok) return null;
		const buf = await res.arrayBuffer();
		return Buffer.from(buf.slice(0, MAX_BYTES)).toString('utf8');
	} catch {
		return null;
	} finally {
		clearTimeout(t);
	}
}

function clean(s: unknown): string {
	return String(s ?? '')
		.replace(/\s+/g, ' ')
		.trim();
}

/** Pull the first schema.org Recipe node out of any JSON-LD blocks. */
function findRecipeNode(html: string): Record<string, unknown> | null {
	const dom = new JSDOM(html);
	const scripts = dom.window.document.querySelectorAll('script[type="application/ld+json"]');
	for (const s of scripts) {
		let data: unknown;
		try {
			data = JSON.parse(s.textContent || '');
		} catch {
			continue;
		}
		const candidates: unknown[] = [];
		const walk = (v: unknown) => {
			if (Array.isArray(v)) v.forEach(walk);
			else if (v && typeof v === 'object') {
				candidates.push(v);
				const graph = (v as Record<string, unknown>)['@graph'];
				if (graph) walk(graph);
			}
		};
		walk(data);
		for (const c of candidates) {
			const type = (c as Record<string, unknown>)['@type'];
			const types = Array.isArray(type) ? type : [type];
			if (types.some((t) => String(t).toLowerCase() === 'recipe')) {
				return c as Record<string, unknown>;
			}
		}
	}
	return null;
}

function parseIngredients(node: Record<string, unknown>): string[] {
	const raw = node.recipeIngredient ?? node.ingredients;
	if (!Array.isArray(raw)) return [];
	return raw.map(clean).filter(Boolean).slice(0, 60);
}

function parseSteps(node: Record<string, unknown>): string[] {
	const raw = node.recipeInstructions;
	const out: string[] = [];
	const pushStep = (v: unknown) => {
		if (typeof v === 'string') out.push(clean(v));
		else if (v && typeof v === 'object') {
			const o = v as Record<string, unknown>;
			if (o.text) out.push(clean(o.text));
			else if (o.name) out.push(clean(o.name));
			else if (Array.isArray(o.itemListElement)) o.itemListElement.forEach(pushStep);
		}
	};
	if (typeof raw === 'string') {
		// Some sites cram all steps into one string separated by newlines.
		raw
			.split(/\r?\n|(?<=\.)\s{2,}/)
			.map(clean)
			.filter((s) => s.length > 3)
			.forEach((s) => out.push(s));
	} else if (Array.isArray(raw)) {
		raw.forEach(pushStep);
	}
	return out.filter(Boolean).slice(0, 40);
}

function parseImage(node: Record<string, unknown>): string | undefined {
	const img = node.image;
	if (typeof img === 'string') return img;
	if (Array.isArray(img)) {
		const first = img[0];
		if (typeof first === 'string') return first;
		if (first && typeof first === 'object') return clean((first as Record<string, unknown>).url);
	}
	if (img && typeof img === 'object')
		return clean((img as Record<string, unknown>).url) || undefined;
	return undefined;
}

/** Scrape a recipe URL. Returns null if blocked/unreachable/unparseable. */
export async function scrapeRecipe(url: string): Promise<ScrapedRecipe | null> {
	if (!/^https?:\/\//i.test(url)) return null;
	if (!(await isAllowed(url))) return null;
	const html = await fetchHtml(url);
	if (!html) return null;

	const node = findRecipeNode(html);
	if (node) {
		const ingredients = parseIngredients(node);
		const steps = parseSteps(node);
		if (ingredients.length || steps.length) {
			return {
				name: clean(node.name) || 'Recipe',
				image: parseImage(node),
				ingredients,
				steps,
				sourceUrl: url
			};
		}
	}

	// Fallback: Readability gives us a title + prose (no structured lists).
	try {
		const doc = new JSDOM(html, { url }).window.document;
		const article = new Readability(doc.cloneNode(true) as Document).parse();
		if (article) {
			return {
				name: clean(article.title) || 'Recipe',
				ingredients: [],
				steps: (article.textContent || '')
					.split(/\r?\n/)
					.map(clean)
					.filter((s) => s.length > 20)
					.slice(0, 20),
				sourceUrl: url
			};
		}
	} catch {
		/* nothing usable */
	}
	return null;
}
