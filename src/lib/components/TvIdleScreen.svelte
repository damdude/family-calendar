<script lang="ts">
	/**
	 * TV mode's idle-time screen: a QR inviting phone control, plus the date
	 * and time, instead of the old clock/photos screensaver. Disappears the
	 * moment a phone actually pairs — the live dashboard, following their
	 * navigation, is what's useful to show then — and reappears automatically
	 * once they disconnect (handled by the caller; this component only
	 * renders while that's true).
	 *
	 * Anti-burn-in: the whole layout gently drifts between a few positions on
	 * a timer, and — periodically — swaps to a few seconds of the
	 * Vestaboard's flipping animation before returning, so the panel is never
	 * showing one static frame for hours on end.
	 */
	import { mirror } from '$lib/stores/mirror.svelte';
	import { family } from '$lib/stores/family.svelte';
	import { formatClock, formatRange, sameDay } from '$lib/time';
	import Vestaboard from './Vestaboard.svelte';
	import { Smartphone, CalendarDays } from 'lucide-svelte';

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

	// Every few minutes, a brief Vestaboard flourish instead of the plain QR.
	const FLOURISH_EVERY_MS = 4 * 60_000;
	const FLOURISH_DURATION_MS = 9_000;
	let showFlourish = $state(false);
	$effect(() => {
		const id = setInterval(() => (showFlourish = true), FLOURISH_EVERY_MS);
		return () => clearInterval(id);
	});
	$effect(() => {
		if (!showFlourish) return;
		const id = setTimeout(() => (showFlourish = false), FLOURISH_DURATION_MS);
		return () => clearTimeout(id);
	});

	let now = $state(new Date());
	$effect(() => {
		const id = setInterval(() => (now = new Date()), 1000);
		return () => clearInterval(id);
	});
	const clock24 = $derived(family.config.view.clock24h);
	const dateStr = $derived(
		now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
	);

	// Tomorrow's agenda, so a glance at the sleeping screen previews the day
	// ahead without waking the display up.
	const tomorrowEvents = $derived.by(() => {
		const tomorrow = new Date(now);
		tomorrow.setDate(tomorrow.getDate() + 1);
		return [...family.data.events]
			.filter((e) => sameDay(e.start, tomorrow))
			.sort((a, b) => a.start.getTime() - b.start.getTime())
			.slice(0, 6);
	});
</script>

{#if showFlourish}
	<Vestaboard />
{:else}
	<div class="tvidle" role="status" aria-label="Waiting for a phone to connect">
		<div class="layout" style:transform="translate({pos.x}vmin, {pos.y}vmin)">
			<div class="content">
				{#if mirror.qrSvg}
					<div class="qr">
						<!-- eslint-disable-next-line svelte/no-at-html-tags -->
						{@html mirror.qrSvg}
					</div>
				{/if}
				<time class="clock">{formatClock(now, clock24)}</time>
				<p class="date">{dateStr}</p>
				<p class="hint"><Smartphone size={18} /> Scan to add events, lists and more</p>
			</div>
			{#if tomorrowEvents.length}
				<div class="tomorrow">
					<p class="tomorrow-head"><CalendarDays size={16} /> Tomorrow</p>
					{#each tomorrowEvents as e (e.id)}
						<div class="trow">
							<span class="ttime"
								>{e.allDay ? 'All day' : formatRange(e.start, e.end, clock24)}</span
							>
							<div class="tbody">
								<p class="ttitle">{e.title}</p>
								{#if e.location}<p class="tloc">{e.location}</p>{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
{/if}

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
		align-items: center;
		gap: clamp(32px, 6vmin, 96px);
		transition: transform 3s ease-in-out;
	}
	.content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: clamp(12px, 2.5vmin, 28px);
		text-align: center;
	}
	.tomorrow {
		display: flex;
		flex-direction: column;
		gap: clamp(10px, 1.6vmin, 18px);
		width: clamp(220px, 24vmin, 340px);
		text-align: left;
	}
	.tomorrow-head {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: clamp(0.85rem, 1.8vmin, 1.15rem);
		font-weight: 500;
		opacity: 0.6;
		margin: 0 0 clamp(4px, 1vmin, 10px);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.trow {
		display: flex;
		gap: clamp(10px, 1.6vmin, 18px);
	}
	.ttime {
		flex: none;
		width: clamp(70px, 9vmin, 110px);
		font-size: clamp(0.8rem, 1.6vmin, 1.05rem);
		font-variant-numeric: tabular-nums;
		opacity: 0.55;
		padding-top: 0.15em;
	}
	.tbody {
		min-width: 0;
	}
	.ttitle {
		font-size: clamp(0.9rem, 1.9vmin, 1.2rem);
		font-weight: 500;
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.tloc {
		font-size: clamp(0.75rem, 1.5vmin, 1rem);
		opacity: 0.5;
		margin: 2px 0 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.qr {
		width: clamp(140px, 22vmin, 320px);
		height: clamp(140px, 22vmin, 320px);
		padding: clamp(10px, 1.6vmin, 20px);
		background: #fff;
		border-radius: clamp(10px, 1.6vmin, 20px);
	}
	.qr :global(svg) {
		width: 100%;
		height: 100%;
		display: block;
	}
	.clock {
		font-size: clamp(2.4rem, 8vmin, 6rem);
		font-weight: 200;
		line-height: 1;
		letter-spacing: -0.02em;
		font-variant-numeric: tabular-nums;
	}
	.date {
		font-size: clamp(1rem, 2.4vmin, 1.6rem);
		font-weight: 300;
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
	@media (prefers-reduced-motion: reduce) {
		.layout {
			transition: none;
		}
	}
</style>
