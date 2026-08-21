<script lang="ts">
	import { family } from '$lib/stores/family.svelte';
	import { screensaver } from '$lib/stores/screensaver.svelte';
	import { mirror } from '$lib/stores/mirror.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import Screensaver from '$lib/components/Screensaver.svelte';
	import TvIdleScreen from '$lib/components/TvIdleScreen.svelte';
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
	// The sleep window forces the screensaver on outside of the snooze below —
	// otherwise it'd flip back on every few seconds all night regardless of
	// anyone touching the screen.
	const sleepActive = $derived(
		family.config.sleep.enabled &&
			isWithinWindow(new Date(tick), family.config.sleep.start, family.config.sleep.end)
	);
	const idleActive = $derived(
		sv.enabled && sv.idleMinutes > 0 && tick - lastActivity > sv.idleMinutes * 60_000
	);
	// A dismiss always guarantees a real window of "definitely off" — a tap
	// resetting `lastActivity` isn't enough on its own to prove the screen
	// actually comes back, since `tick`/`lastActivity` can already be stale by
	// the moment screensaverActive first turns true (e.g. switching this
	// screen from TV to touch mode after it sat idle — TV mode is exempt from
	// the screensaver entirely, so nothing had been resetting the idle clock —
	// which otherwise reads as "the screensaver came on and touch does
	// nothing," since every recomputation immediately re-triggers it.
	let snoozedUntil = $state(0);
	// Same idle/sleep-window/"Sleep now" condition drives both modes' idle
	// state — only the content shown for it differs below.
	const idleOrSleepActive = $derived(
		tick < snoozedUntil
			? false
			: screensaver.forceSleep || (sv.enabled && (sleepActive || idleActive))
	);
	// TV: the QR + clock idle screen (TvIdleScreen) — but only while nobody's
	// actively driving it from a phone, since the live dashboard following
	// their navigation is what's useful to show then instead.
	const tvIdleActive = $derived(family.isTv && idleOrSleepActive && !mirror.controllerConnected);
	// Touch: the original dismissible clock/photos screensaver, unchanged.
	const touchScreensaverActive = $derived(!family.isTv && idleOrSleepActive);
</script>

<div
	class="app"
	class:rotated={family.rotationDeg !== 0}
	data-orientation={family.orientation}
	style:--rotate-deg="{family.rotationDeg}deg"
	style:--bottom-nav-clearance={family.orientation === 'portrait' ? '80px' : '0px'}
>
	<Sidebar />
	<div class="content">
		<TopBar />
		<main use:dragScroll>
			{@render children()}
		</main>
	</div>
</div>

<!-- Full QR on a TV (the only way in), a small icon on a touchscreen. -->
{#if !tvIdleActive && !touchScreensaverActive}
	<PhoneMirrorPanel />
{/if}

{#if tvIdleActive}
	<TvIdleScreen />
{/if}

{#if touchScreensaverActive}
	<Screensaver
		mode={sv.mode}
		ondismiss={() => {
			screensaver.forceSleep = false;
			lastActivity = Date.now();
			snoozedUntil = Date.now() + 10_000;
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
	/* Compensates for a panel that was physically rotated 90° without its
	   OS/compositor rotating the framebuffer to match: render into a box with
	   the OLD (raw) dimensions swapped in, then rotate the whole thing back so
	   it lands upright on the physically-turned screen. */
	.app.rotated {
		position: fixed;
		inset: 0;
		top: 50%;
		left: 50%;
		width: 100vh;
		height: 100vw;
		transform: translate(-50%, -50%) rotate(var(--rotate-deg));
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
