<script lang="ts">
	import { family } from '$lib/stores/family.svelte';
	import { mirror } from '$lib/stores/mirror.svelte';
	import { formatClock } from '$lib/time';
	import WeatherChip from './WeatherChip.svelte';
	import { Smartphone } from 'lucide-svelte';

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
		<!-- Pairing QR now lives in PhoneMirrorPanel (always-on for TV, icon for touch). -->
		{#if mirror.role === 'display' && mirror.connected}
			<span class="pair live"><Smartphone size={18} /> Phone paired</span>
		{/if}
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
	.pair {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		padding: 8px 14px;
		border-radius: var(--radius-pill);
		background: var(--color-surface-elevated);
		color: var(--color-text-secondary);
		font-weight: var(--weight-semibold);
		font-size: var(--text-sm);
		text-decoration: none;
	}
	.pair:hover {
		background: color-mix(in srgb, var(--color-profile-blue) 20%, var(--color-surface-elevated));
		color: var(--color-text-primary);
	}
	.pair.live {
		background: color-mix(in srgb, var(--color-accent-success) 22%, var(--color-surface));
		color: #10391f;
	}
	.clock {
		color: var(--color-text-primary);
		font-variant-numeric: tabular-nums;
	}
</style>
