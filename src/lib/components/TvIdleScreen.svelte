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
	import { formatClock } from '$lib/time';
	import Vestaboard from './Vestaboard.svelte';
	import { Smartphone } from 'lucide-svelte';

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
</script>

{#if showFlourish}
	<Vestaboard />
{:else}
	<div class="tvidle" role="status" aria-label="Waiting for a phone to connect">
		<div class="content" style:transform="translate({pos.x}vmin, {pos.y}vmin)">
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
	.content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: clamp(12px, 2.5vmin, 28px);
		text-align: center;
		transition: transform 3s ease-in-out;
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
		.content {
			transition: none;
		}
	}
</style>
