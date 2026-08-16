<script lang="ts">
	import { family } from '$lib/stores/family.svelte';
	import { mirror } from '$lib/stores/mirror.svelte';
	import { formatClock } from '$lib/time';
	import WeatherChip from './WeatherChip.svelte';
	import { Smartphone, Wifi, WifiOff, WifiLow } from 'lucide-svelte';

	// Live clock — ticks once a second, cleaned up on unmount.
	let now = $state(new Date());
	$effect(() => {
		const id = setInterval(() => (now = new Date()), 1000);
		return () => clearInterval(id);
	});

	const clock = $derived(formatClock(now, family.config.view.clock24h));

	// Wi-Fi status — cheap enough (no rescan) to poll continuously so the icon
	// reflects reality the moment the connection drops, not just on page load.
	let wifi = $state<{ online: boolean; ssid: string | null; signal: number | null }>({
		online: true,
		ssid: null,
		signal: null
	});
	$effect(() => {
		let cancelled = false;
		const poll = async () => {
			try {
				const r = await fetch('/api/net/status');
				if (r.ok && !cancelled) wifi = await r.json();
			} catch {
				/* keep the last known state */
			}
		};
		poll();
		const id = setInterval(poll, 15000);
		return () => {
			cancelled = true;
			clearInterval(id);
		};
	});
</script>

<header class="topbar">
	<h1 class="family type-title-lg">{family.data.familyName}</h1>
	<div class="right">
		<!-- Pairing QR lives in PhoneMirrorPanel (always-on for TV, icon for touch);
		     this reflects whether a phone is actually paired right now, not just
		     whether our own SSE stream to the server happens to be open. -->
		{#if mirror.role === 'display' && mirror.controllerConnected}
			<span class="pair live"><Smartphone size={18} /> Phone paired</span>
		{/if}
		<time class="clock type-title-lg">{clock}</time>
		<span
			class="wifi"
			class:off={!wifi.online}
			title={wifi.online ? (wifi.ssid ?? 'Connected') : 'Not connected to Wi-Fi'}
		>
			{#if !wifi.online}
				<WifiOff size={18} />
			{:else if wifi.signal !== null && wifi.signal < 50}
				<WifiLow size={18} />
			{:else}
				<Wifi size={18} />
			{/if}
		</span>
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
	.wifi {
		display: inline-flex;
		color: var(--color-text-secondary);
	}
	.wifi.off {
		color: var(--color-accent-warning);
	}
</style>
