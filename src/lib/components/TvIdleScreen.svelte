<script lang="ts">
	/**
	 * TV mode's idle-time screen: a QR inviting phone control, plus the date,
	 * weather, and the next two days' events — instead of the old clock/photos
	 * screensaver. Disappears the moment a phone actually pairs — the live
	 * dashboard, following their navigation, is what's useful to show then —
	 * and reappears automatically once they disconnect (handled by the
	 * caller; this component only renders while that's true).
	 *
	 * The periodic Vestaboard flourish lives one level up (the root layout)
	 * now, since it needs to interrupt the daytime calendar view too, not
	 * just this screen.
	 *
	 * Anti-burn-in: the whole layout gently drifts between a few positions on
	 * a timer, so the panel is never showing one static frame for hours on end.
	 */
	import { mirror } from '$lib/stores/mirror.svelte';
	import { family } from '$lib/stores/family.svelte';
	import { formatClock, formatRange, sameDay } from '$lib/time';
	import { Smartphone } from 'lucide-svelte';

	// Redundant with PhoneMirrorPanel's own ensureQr() call — that component
	// is unmounted while this screen shows, so if its fetch happened to fail
	// (e.g. a deploy's restart landed mid-request) nothing else was ever
	// re-triggering it, leaving THE most QR-dependent screen on the device
	// permanently without one. ensureQr() itself is a no-op once qrSvg is set.
	$effect(() => {
		mirror.ensureQr();
	});

	// Drift through a small set of offsets so the QR/clock never sits on
	// exactly the same pixels for too long.
	const POSITIONS = [
		{ x: 0, y: 0 },
		{ x: -2, y: 1.5 },
		{ x: 2, y: 0 },
		{ x: 0, y: -1.5 },
		{ x: -1.5, y: -1 },
		{ x: 1.5, y: 1 }
	];
	let posIndex = $state(0);
	$effect(() => {
		const id = setInterval(() => (posIndex = (posIndex + 1) % POSITIONS.length), 45_000);
		return () => clearInterval(id);
	});
	const pos = $derived(POSITIONS[posIndex]);

	let now = $state(new Date());
	$effect(() => {
		const id = setInterval(() => (now = new Date()), 1000);
		return () => clearInterval(id);
	});
	const clock24 = $derived(family.config.view.clock24h);
	const dateStr = $derived(
		now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
	);
	const weather = $derived(family.data.weather);

	// Exactly the next two days — tomorrow on the left, the day after on the
	// right — so the QR stays the visual focus and this reads at a glance
	// rather than turning into a scroll-free wall of a whole week.
	function dayEvents(offset: number) {
		const d = new Date(now);
		d.setDate(d.getDate() + offset);
		return [...family.data.events]
			.filter((e) => sameDay(e.start, d))
			.sort((a, b) => a.start.getTime() - b.start.getTime());
	}
	const col1 = $derived(dayEvents(1));
	const col2 = $derived(dayEvents(2));
	const col1Label = $derived('Tomorrow');
	const col2Label = $derived.by(() => {
		const d = new Date(now);
		d.setDate(d.getDate() + 2);
		return d.toLocaleDateString(undefined, { weekday: 'long' });
	});
</script>

<div class="tvidle" role="status" aria-label="Waiting for a phone to connect">
	<div class="layout" style:transform="translate({pos.x}vmin, {pos.y}vmin)">
		<div class="top">
			{#if mirror.qrSvg}
				<div class="qr">
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					{@html mirror.qrSvg}
				</div>
			{/if}
			<time class="clock">{formatClock(now, clock24)}</time>
			<p class="date">{dateStr}</p>
			{#if weather.icon !== '—'}
				<p class="weather">{weather.icon} {weather.tempF}° {weather.condition}</p>
			{/if}
			<p class="hint"><Smartphone size={18} /> Scan to add events, lists and more</p>
		</div>

		{#if col1.length || col2.length}
			<div class="days">
				<div class="daycol">
					<p class="daycol-head">{col1Label}</p>
					{#if col1.length === 0}
						<p class="empty">Nothing planned</p>
					{:else}
						{#each col1 as e (e.id)}
							<div class="erow">
								<p class="etitle">{e.title}</p>
								<p class="emeta">
									{e.allDay ? 'All day' : formatRange(e.start, e.end, clock24)}{#if e.location}
										· {e.location}{/if}
								</p>
							</div>
						{/each}
					{/if}
				</div>
				<div class="divider" aria-hidden="true"></div>
				<div class="daycol">
					<p class="daycol-head">{col2Label}</p>
					{#if col2.length === 0}
						<p class="empty">Nothing planned</p>
					{:else}
						{#each col2 as e (e.id)}
							<div class="erow">
								<p class="etitle">{e.title}</p>
								<p class="emeta">
									{e.allDay ? 'All day' : formatRange(e.start, e.end, clock24)}{#if e.location}
										· {e.location}{/if}
								</p>
							</div>
						{/each}
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.tvidle {
		position: fixed;
		inset: 0;
		z-index: 200;
		background: #000;
		color: #fff;
		display: grid;
		place-items: center;
		overflow: hidden;
	}
	.layout {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: clamp(20px, 3.5vmin, 44px);
		max-height: 92vh;
		transition: transform 3s ease-in-out;
	}
	.top {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: clamp(10px, 2vmin, 22px);
		text-align: center;
		flex: none;
	}
	.qr {
		width: clamp(140px, 20vmin, 280px);
		height: clamp(140px, 20vmin, 280px);
		padding: clamp(10px, 1.5vmin, 18px);
		background: #fff;
		border-radius: clamp(10px, 1.5vmin, 18px);
	}
	.qr :global(svg) {
		width: 100%;
		height: 100%;
		display: block;
	}
	.clock {
		font-size: clamp(2.2rem, 7vmin, 5.4rem);
		font-weight: 200;
		line-height: 1;
		letter-spacing: -0.02em;
		font-variant-numeric: tabular-nums;
	}
	.date {
		font-size: clamp(0.95rem, 2.2vmin, 1.5rem);
		font-weight: 300;
		opacity: 0.75;
		margin: 0;
	}
	.weather {
		font-size: clamp(0.9rem, 2vmin, 1.4rem);
		font-weight: 400;
		opacity: 0.75;
		margin: 0;
	}
	.hint {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: clamp(0.85rem, 1.8vmin, 1.15rem);
		opacity: 0.6;
		margin: 0;
	}

	/* Two-column next-two-days summary. */
	.days {
		display: flex;
		align-items: stretch;
		gap: clamp(20px, 3vmin, 48px);
		width: clamp(420px, 56vmin, 900px);
		max-width: 92vw;
	}
	.daycol {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: clamp(10px, 1.5vmin, 18px);
		text-align: center;
	}
	.divider {
		flex: none;
		width: 1px;
		background: rgba(255, 255, 255, 0.35);
	}
	.daycol-head {
		font-size: clamp(0.75rem, 1.5vmin, 1rem);
		font-weight: 600;
		opacity: 0.65;
		margin: 0 0 clamp(2px, 0.5vmin, 6px);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.empty {
		font-size: clamp(0.8rem, 1.5vmin, 1.05rem);
		opacity: 0.4;
		margin: 0;
	}
	.erow {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.etitle {
		font-size: clamp(0.85rem, 1.7vmin, 1.15rem);
		font-weight: 500;
		margin: 0;
		/* Wrap instead of truncating — a long title should stay fully
		   readable on a screen nobody can scroll or tap to expand. */
		overflow-wrap: break-word;
	}
	.emeta {
		font-size: clamp(0.7rem, 1.3vmin, 0.95rem);
		font-variant-numeric: tabular-nums;
		opacity: 0.55;
		margin: 0;
		overflow-wrap: break-word;
	}
	@media (prefers-reduced-motion: reduce) {
		.layout {
			transition: none;
		}
	}
</style>
