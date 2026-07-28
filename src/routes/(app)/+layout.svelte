<script lang="ts">
	import { family } from '$lib/stores/family.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import Screensaver from '$lib/components/Screensaver.svelte';
	import { dragScroll } from '$lib/actions/dragScroll';
	import { isWithinWindow } from '$lib/time';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	// Apply persisted config (family name, profiles, feature flags, orientation)
	// and kid progress (streaks, completions, feelings) onto the store.
	$effect(() => {
		family.applyConfig(data.config);
		family.applyProgress(data.progress);
		family.applyFamilyData(data.familyData);
		family.applySyncedEvents(data.syncedEvents);
	});

	// --- Screensaver / sleep mode ---
	let tick = $state(Date.now());
	let lastActivity = $state(Date.now());
	$effect(() => {
		const iv = setInterval(() => (tick = Date.now()), 5000);
		const act = () => {
			lastActivity = Date.now();
			tick = Date.now();
		};
		window.addEventListener('pointerdown', act);
		window.addEventListener('keydown', act);
		return () => {
			clearInterval(iv);
			window.removeEventListener('pointerdown', act);
			window.removeEventListener('keydown', act);
		};
	});
	const sv = $derived(family.config.screensaver);
	// The sleep window forces the screensaver on (a tap won't dismiss it).
	const sleepActive = $derived(
		family.config.sleep.enabled &&
			isWithinWindow(new Date(tick), family.config.sleep.start, family.config.sleep.end)
	);
	const idleActive = $derived(
		sv.enabled && sv.idleMinutes > 0 && tick - lastActivity > sv.idleMinutes * 60_000
	);
	const screensaverActive = $derived(sv.enabled && (sleepActive || idleActive));
</script>

<div class="app" data-orientation={family.orientation}>
	<Sidebar />
	<div class="content">
		<TopBar />
		<main use:dragScroll>
			{@render children()}
		</main>
	</div>
</div>

{#if screensaverActive}
	<Screensaver mode={sv.mode} />
{/if}

<style>
	.app {
		display: flex;
		height: 100vh;
		width: 100vw;
		overflow: hidden;
	}
	.content {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
		min-height: 0;
		background: var(--color-canvas);
	}
	main {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 0 var(--space-6) var(--space-6);
		touch-action: pan-y;
	}
	main:global(.dragging) {
		user-select: none;
		cursor: grabbing;
	}

	/* Portrait: nav moves to the bottom as a horizontal bar. */
	.app[data-orientation='portrait'] {
		flex-direction: column;
	}
	.app[data-orientation='portrait'] .content {
		order: 1;
	}
	.app[data-orientation='portrait'] :global(.sidebar) {
		order: 2;
	}
</style>
