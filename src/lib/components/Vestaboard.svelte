<script lang="ts">
	import { family } from '$lib/stores/family.svelte';
	import { formatClock } from '$lib/time';
	import { onMount } from 'svelte';

	let { ondismiss }: { ondismiss?: () => void } = $props();

	const ROWS = 6;
	const COLS = 22;
	// Split-flap roll order: blank, letters, digits, punctuation. Flaps only ever
	// advance forwards through this sequence, which is what gives the cascade.
	const CHARSET = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!?:'-&/#$%°";
	const INDEX: Record<string, number> = {};
	for (let i = 0; i < CHARSET.length; i++) INDEX[CHARSET[i]] = i;
	const idxOf = (c: string) => INDEX[c.toUpperCase()] ?? 0;

	const STEP_MS = 42; // time to seat one flap
	const COL_STAGGER = 45; // ripple delay per column

	type Board = { lines: string[]; color?: string };

	// ── Content the board rotates through ───────────────────────────────────────
	let feed = $state<{
		headlines: { source: string; text: string }[];
		joke: { q: string; a: string };
		birthdays: { title: string; startTs: number }[];
	}>({ headlines: [], joke: { q: '', a: '' }, birthdays: [] });

	async function loadFeed() {
		try {
			const r = await fetch('/api/vestaboard');
			if (r.ok) feed = await r.json();
		} catch {
			/* offline — compose from local data only */
		}
	}

	const cfg = $derived(family.config.screensaver.vestaboard);
	const clock24 = $derived(family.config.view.clock24h);
	// TV has no touch, so this is the only surface it ever shows — full-bleed,
	// no chrome to compete with the board, and a fixed fast cadence since
	// there's no one to open the settings gear and tune it. Touch mode keeps
	// the framed look + configurable timing since it's reached by choice.
	const isTv = $derived(family.isTv);

	function whenLabel(d: Date): string {
		const now = new Date();
		const sameDay = d.toDateString() === now.toDateString();
		const tomorrow = new Date(now.getTime() + 86_400_000).toDateString() === d.toDateString();
		const t = formatClock(d, clock24).toUpperCase();
		if (sameDay) return `TODAY ${t}`;
		if (tomorrow) return `TOMORROW ${t}`;
		return `${d.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase()} ${t}`;
	}

	// Date only, no time — birthdays sync as all-day events, so a clock time
	// on the board wouldn't mean anything.
	function dateLabel(d: Date): string {
		const now = new Date();
		if (d.toDateString() === now.toDateString()) return 'TODAY';
		if (new Date(now.getTime() + 86_400_000).toDateString() === d.toDateString()) return 'TOMORROW';
		return d
			.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
			.toUpperCase();
	}

	const boards = $derived.by<Board[]>(() => {
		const out: Board[] = [];

		// Custom family messages (welcome / happy birthday / …).
		for (const m of cfg.messages) {
			if (m.trim()) out.push({ lines: [m.trim()], color: 'violet' });
		}

		// Weather.
		if (cfg.showWeather) {
			const w = family.data.weather;
			out.push({
				lines: ['TODAYS WEATHER', `${w.tempF}${'°'}F  ${w.condition}`],
				color: 'blue'
			});
		}

		// Upcoming events.
		if (cfg.showEvents) {
			const now = Date.now();
			const upcoming = [...family.data.events]
				.filter((e) => e.end.getTime() > now)
				.sort((a, b) => a.start.getTime() - b.start.getTime())
				.slice(0, 3);
			for (const e of upcoming) {
				out.push({ lines: ['UP NEXT', e.title, whenLabel(e.start)], color: 'green' });
			}
		}

		// Kids.
		if (cfg.showKids) {
			for (const p of family.profiles.filter((p) => p.role === 'child')) {
				const streak = Math.max(
					0,
					...family.data.routines.filter((r) => r.profileId === p.id).map((r) => r.streak.current)
				);
				const second = streak > 0 ? `${streak} DAY STREAK` : 'HAVE A GREAT DAY';
				out.push({ lines: [p.name, second], color: 'orange' });
			}
		}

		// Joke of the day.
		if (cfg.showJokes && feed.joke.q) {
			out.push({ lines: ['JOKE OF THE DAY', feed.joke.q, feed.joke.a], color: 'yellow' });
		}

		// Headlines pulled from Sites of Interest.
		if (cfg.showNews) {
			for (const h of feed.headlines) {
				out.push({ lines: [h.source, h.text], color: 'red' });
			}
		}

		// Upcoming birthdays — from whichever synced calendar was flagged as
		// a birthdays feed (Settings → Calendars).
		if (cfg.showBirthdays) {
			for (const b of feed.birthdays.slice(0, 3)) {
				out.push({
					lines: ['BIRTHDAY', b.title, dateLabel(new Date(b.startTs * 1000))],
					color: 'pink'
				});
			}
		}

		if (out.length === 0) out.push({ lines: [family.data.familyName || 'FAMILY', 'CALENDAR'] });
		return out;
	});

	// ── Turn a board into a fixed 6×22 grid of upper-case chars ─────────────────
	function wrap(text: string): string[] {
		const words = text.toUpperCase().replace(/\s+/g, ' ').trim().split(' ');
		const lines: string[] = [];
		let cur = '';
		for (const w of words) {
			const word = w.length > COLS ? w.slice(0, COLS) : w;
			if (!cur) cur = word;
			else if (cur.length + 1 + word.length <= COLS) cur += ' ' + word;
			else {
				lines.push(cur);
				cur = word;
			}
		}
		if (cur) lines.push(cur);
		return lines;
	}

	function center(s: string): string {
		s = s.slice(0, COLS);
		const pad = COLS - s.length;
		const left = Math.floor(pad / 2);
		return ' '.repeat(left) + s + ' '.repeat(pad - left);
	}

	function layout(board: Board): string[] {
		let lines: string[] = [];
		for (const l of board.lines) lines.push(...wrap(l));
		lines = lines.slice(0, ROWS);
		// Vertically centre.
		const top = Math.floor((ROWS - lines.length) / 2);
		const grid: string[] = [];
		for (let r = 0; r < ROWS; r++) {
			const src = lines[r - top];
			grid.push(center(src ?? ''));
		}
		return grid;
	}

	// ── Flap animation engine ───────────────────────────────────────────────────
	// Driven by setInterval (not rAF) so the cascade keeps flipping even if the
	// kiosk tab is briefly backgrounded.
	type Cell = { i: number; t: number; startAt: number; phase: number };
	let cells = $state<Cell[]>(
		Array.from({ length: ROWS * COLS }, () => ({ i: 0, t: 0, startAt: 0, phase: 0 }))
	);

	let boardIndex = $state(0);

	function setTarget(grid: string[]) {
		const now = performance.now();
		for (let r = 0; r < ROWS; r++) {
			for (let c = 0; c < COLS; c++) {
				const k = r * COLS + c;
				cells[k].t = idxOf(grid[r][c]);
				cells[k].startAt = now + c * COL_STAGGER;
			}
		}
	}

	let lastFrame = 0;
	function step() {
		const now = performance.now();
		// Advance by however many flap-steps the elapsed time is worth (>=1). This
		// keeps it smooth at ~STEP_MS on a live kiosk, yet still converges quickly
		// if a background tab throttles the interval to 1s+.
		const advance = lastFrame === 0 ? 1 : Math.max(1, Math.round((now - lastFrame) / STEP_MS));
		lastFrame = now;
		for (let k = 0; k < cells.length; k++) {
			const cell = cells[k];
			if (cell.i === cell.t) continue;
			if (now < cell.startAt) continue;
			const dist = (cell.t - cell.i + CHARSET.length) % CHARSET.length;
			const move = Math.min(advance, dist);
			cell.i = (cell.i + move) % CHARSET.length;
			cell.phase ^= 1;
		}
	}

	onMount(() => {
		loadFeed();
		const feedTimer = setInterval(loadFeed, 5 * 60_000);
		setTarget(layout(boards[0]));
		lastFrame = 0;
		const stepTimer = setInterval(step, STEP_MS);
		return () => {
			clearInterval(stepTimer);
			clearInterval(feedTimer);
		};
	});

	// Rotate boards on the configured cadence — fixed at 10s on TV, since
	// there's no one there to tune the "seconds per board" setting.
	$effect(() => {
		const hold = (isTv ? 10 : Math.max(4, cfg.holdSeconds)) * 1000;
		const id = setInterval(() => {
			boardIndex = (boardIndex + 1) % boards.length;
		}, hold);
		return () => clearInterval(id);
	});

	// Whenever the shown board changes, retarget the flaps.
	$effect(() => {
		const b = boards[boardIndex % boards.length];
		if (b) setTarget(layout(b));
	});

	const activeColor = $derived(boards[boardIndex % boards.length]?.color);
	const chipColor: Record<string, string> = {
		red: '#d9483b',
		orange: '#e07b2e',
		yellow: '#e8b93b',
		green: '#3f9d5a',
		blue: '#3a6ea5',
		violet: '#7a5aa8',
		pink: '#d0568f'
	};

	// Live clock in the footer.
	let clock = $state(new Date());
	$effect(() => {
		const id = setInterval(() => (clock = new Date()), 1000);
		return () => clearInterval(id);
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="vboard-saver"
	class:tv={isTv}
	style="--accent:{activeColor ? chipColor[activeColor] : 'transparent'}"
	onpointerdown={() => ondismiss?.()}
>
	<div class="board" aria-hidden="true">
		{#each cells as cell, k (k)}
			<div class="flap" class:a={cell.phase === 0} class:b={cell.phase === 1}>
				<span class="face">{CHARSET[cell.i]}</span>
			</div>
		{/each}
	</div>
	{#if !isTv}
		<footer class="vfoot">
			<span>{family.data.familyName || 'FAMILY CALENDAR'}</span>
			<span class="dot" style="background:{activeColor ? chipColor[activeColor] : '#555'}"></span>
			<span>{formatClock(clock, clock24)}</span>
		</footer>
	{/if}
</div>

<style>
	.vboard-saver {
		position: fixed;
		inset: 0;
		/* Below PhoneMirrorPanel's permanent TV QR (z-index 90) so it stays
		   visible over the board — a real TV has no other way to control or
		   leave this screen. Still above ordinary page content (z-index auto). */
		z-index: 50;
		background: #111114;
		display: flex;
		flex-direction: column;
		align-items: stretch;
		justify-content: stretch;
		gap: clamp(6px, 1.4vh, 20px);
		padding: clamp(10px, 2.2vmin, 28px);
		overflow: hidden;
	}
	.vboard-saver.tv {
		padding: 0;
		gap: 0;
	}
	.board {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: repeat(22, 1fr);
		grid-template-rows: repeat(6, 1fr);
		gap: clamp(2px, 0.5vmin, 8px);
		width: 100%;
		padding: clamp(6px, 1vmin, 16px);
		background: #000;
		border-radius: clamp(8px, 1.4vmin, 22px);
		box-shadow:
			0 0 0 3px var(--accent, transparent),
			0 24px 60px rgba(0, 0, 0, 0.6);
	}
	/* Edge-to-edge on TV: no frame competing with the board, no footer to fit. */
	.vboard-saver.tv .board {
		padding: 0;
		border-radius: 0;
		box-shadow: none;
	}
	.flap {
		position: relative;
		display: grid;
		place-items: center;
		background: linear-gradient(#2a2a30, #202025 49%, #1a1a1e 50%, #232329);
		border-radius: clamp(2px, 0.5vmin, 5px);
		overflow: hidden;
		min-width: 0;
		min-height: 0;
		font-family: 'DM Mono', 'SF Mono', ui-monospace, 'Courier New', monospace;
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.6);
	}
	/* The horizontal split line of a real flap. */
	.flap::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		top: 50%;
		height: 1px;
		background: rgba(0, 0, 0, 0.75);
	}
	.face {
		font-size: clamp(1rem, 6.2vmin, 9rem);
		font-weight: 600;
		color: #f3ede0;
		line-height: 1;
		transform-origin: center;
		will-change: transform;
	}
	/* Two identical animations toggled a↔b so each flap re-plays on every step. */
	.flap.a .face {
		animation: flip 90ms ease-in;
	}
	.flap.b .face {
		animation: flip 90ms ease-in;
	}
	@keyframes flip {
		0% {
			transform: rotateX(-72deg);
			opacity: 0.5;
		}
		100% {
			transform: rotateX(0deg);
			opacity: 1;
		}
	}
	.vfoot {
		display: flex;
		align-items: center;
		gap: clamp(10px, 2vw, 24px);
		color: #9a958a;
		font-size: clamp(0.8rem, 1.6vw, 1.3rem);
		letter-spacing: 0.15em;
		text-transform: uppercase;
		font-variant-numeric: tabular-nums;
	}
	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
	}
	@media (prefers-reduced-motion: reduce) {
		.flap.a .face,
		.flap.b .face {
			animation: none;
		}
	}
</style>
