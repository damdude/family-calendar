<script lang="ts">
	import { family } from '$lib/stores/family.svelte';
	import { screensaver } from '$lib/stores/screensaver.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import Screensaver from '$lib/components/Screensaver.svelte';
	import PhoneMirrorPanel from '$lib/components/PhoneMirrorPanel.svelte';
	import { dragScroll } from '$lib/actions/dragScroll';
	import { isWithinWindow } from '$lib/time';
	import { invalidateAll } from '$app/navigation';
	import { untrack } from 'svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	// Apply persisted config/progress/family-data/synced-events onto the store.
	// Depend ONLY on the load `data` props (read them here); the apply methods
	// read+write store state, so wrap them in untrack() — otherwise the effect
	// depends on what it mutates and loops forever (freezing the UI).
	$effect(() => {
		const { config, progress, familyData, syncedEvents } = data;
		untrack(() => {
			family.applyConfig(config);
			family.applyProgress(progress);
			family.applyFamilyData(familyData);
			family.applySyncedEvents(syncedEvents);
		});
	});

	// Live refresh: a phone quick-add publishes on /api/live → reload data.
	$effect(() => {
		const es = new EventSource('/api/live');
		es.onmessage = (e) => {
			if (e.data === 'refresh') invalidateAll();
		};
		return () => es.close();
	});

	// Real screen orientation, kept live so a physical rotation (e.g. a
	// touchscreen mounted portrait) is reflected without a manual setting going
	// stale the moment someone turns the panel.
	$effect(() => family.watchOrientation());

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
	// "Sleep now" (forceSleep) always shows; scheduled/idle only when enabled.
	// TV mode has no touch, so nothing could ever dismiss it once shown — and it
	// would hide the persistent pairing QR below, the only way onto the device
	// at all. Never let it activate there, regardless of trigger.
	const screensaverActive = $derived(
		!family.isTv && (screensaver.forceSleep || (sv.enabled && (sleepActive || idleActive)))
	);
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

<!-- Full QR on a TV (the only way in), a small icon on a touchscreen. -->
{#if !screensaverActive}
	<PhoneMirrorPanel />
{/if}

{#if screensaverActive}
	<Screensaver
		mode={sv.mode}
		ondismiss={() => {
			screensaver.forceSleep = false;
			lastActivity = Date.now();
		}}
	/>
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
