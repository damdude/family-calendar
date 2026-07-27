<script lang="ts">
	import { family } from '$lib/stores/family.svelte';
	import { formatClock } from '$lib/time';
	import WeatherChip from './WeatherChip.svelte';

	// Live clock — ticks once a second, cleaned up on unmount.
	let now = $state(new Date());
	$effect(() => {
		const id = setInterval(() => (now = new Date()), 1000);
		return () => clearInterval(id);
	});

	const clock = $derived(formatClock(now, family.config.view.clock24h));
</script>

<header class="topbar">
	<h1 class="family type-title-lg">{family.data.familyName}</h1>
	<div class="right">
		<time class="clock type-title-lg">{clock}</time>
		<WeatherChip weather={family.data.weather} />
	</div>
</header>

<style>
	.topbar {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-4);
		padding: var(--space-4) var(--space-6);
	}
	.family {
		color: var(--color-text-primary);
	}
	.right {
		display: flex;
		align-items: center;
		gap: var(--space-5);
	}
	.clock {
		color: var(--color-text-primary);
		font-variant-numeric: tabular-nums;
	}
</style>
