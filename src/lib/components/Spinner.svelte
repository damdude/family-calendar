<script lang="ts">
	/**
	 * The iOS-style activity indicator: tapered spokes whose opacity chases
	 * around the circle, rather than a rotating arc.
	 *
	 * One component so every "something is happening" in the app reads the
	 * same — Wi-Fi joining, an update installing, a Google account being
	 * authorised, the device password being checked. It draws in
	 * `currentColor`, so it takes the colour of whatever it sits inside.
	 */
	let { size = 20, label = 'Working' }: { size?: number; label?: string } = $props();

	const SPOKES = 8;
</script>

<span class="spinner" style:--size="{size}px" style:--n={SPOKES} role="status" aria-label={label}>
	{#each Array(SPOKES) as _, i (i)}
		<span class="spoke" style:--i={i}></span>
	{/each}
</span>

<style>
	.spinner {
		position: relative;
		display: inline-block;
		width: var(--size);
		height: var(--size);
		flex: none;
		vertical-align: middle;
	}
	.spoke {
		position: absolute;
		left: calc(50% - var(--size) / 16);
		top: 0;
		width: calc(var(--size) / 8);
		height: calc(var(--size) / 3);
		border-radius: calc(var(--size) / 16);
		background: currentColor;
		/* Pivot about the centre of the circle, so rotating the spoke walks it
		   around the rim instead of spinning it in place. */
		transform-origin: center calc(var(--size) / 2);
		transform: rotate(calc(var(--i) * (360deg / var(--n))));
		opacity: 0.15;
		animation: spoke-fade 0.9s linear infinite;
		animation-delay: calc(var(--i) * (0.9s / var(--n)));
	}
	@keyframes spoke-fade {
		0% {
			opacity: 1;
		}
		100% {
			opacity: 0.15;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.spoke {
			animation: none;
			opacity: 0.4;
		}
	}
</style>
