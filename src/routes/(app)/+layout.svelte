<script lang="ts">
	import { family } from '$lib/stores/family.svelte';
	import { screensaver } from '$lib/stores/screensaver.svelte';
	import { mirror } from '$lib/stores/mirror.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import Screensaver from '$lib/components/Screensaver.svelte';
	import TvIdleScreen from '$lib/components/TvIdleScreen.svelte';
	import Vestaboard from '$lib/components/Vestaboard.svelte';
	import PhoneMirrorPanel from '$lib/components/PhoneMirrorPanel.svelte';
	import { dragScroll } from '$lib/actions/dragScroll';
	import { isWithinWindow } from '$lib/time';
	import { isDarkNow } from '$lib/sun';
	import { invalidateAll } from '$app/navigation';
	import { untrack } from 'svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	// Apply persisted config/progress/family-data/synced-events onto the store.
	// Depend ONLY on the load `data` props (read them here); the apply methods
	// read+write store state, so wrap them in untrack() — otherwise the effect
	// depends on what it mutates and loops forever (freezing the UI).
	$effect(() => {
		const { config, progress, familyData, syncedEvents, photoIds } = data;
		untrack(() => {
			family.applyConfig(config);
			family.applyProgress(progress);
			family.applyFamilyData(familyData);
			family.applySyncedEvents(syncedEvents);
			family.applyPhotoIds(photoIds);
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

	// Weather: family.data.weather was never anything but its hardcoded
	// "Unavailable" default anywhere in the app until this — every weather
	// chip (TopBar, Vestaboard, the TV idle screen) reads from the store, so
	// fetching it once here covers all of them. Refreshed every 30 minutes;
	// conditions don't change fast enough to warrant more.
	$effect(() => {
		async function refreshWeather() {
			try {
				const r = await fetch('/api/weather');
				if (r.ok) family.setWeather(await r.json());
			} catch {
				/* offline; next interval retries */
			}
		}
		refreshWeather();
		const id = setInterval(refreshWeather, 30 * 60_000);
		return () => clearInterval(id);
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

	// Daily self-heal reload (TV kiosk only): a browser tab left open for
	// days can accumulate stuck reactive state with no general remedy short
	// of a fresh page load — confirmed as the cause of a bug where the
	// week-view grid froze on a Sunday-only special case straight through
	// the following Tuesday, because it read `new Date()` once inside a
	// $derived that nothing ever re-triggered. Piggyback on the sleep
	// window, since the screen's already dark then, so a reload is
	// invisible; once per calendar day, tracked in localStorage so
	// re-evaluating mid-window doesn't reload repeatedly.
	$effect(() => {
		if (!family.isTv || !sleepActive) return;
		const today = new Date(tick).toDateString();
		if (localStorage.getItem('fc.lastDailyReload') === today) return;
		localStorage.setItem('fc.lastDailyReload', today);
		location.reload();
	});
	// A dismiss always guarantees a real window of "definitely off" — a tap
	// resetting `lastActivity` isn't enough on its own to prove the screen
	// actually comes back, since `tick`/`lastActivity` can already be stale by
	// the moment screensaverActive first turns true — which otherwise reads
	// as "the screensaver came on and touch does nothing," since every
	// recomputation immediately re-triggers it.
	let snoozedUntil = $state(0);
	// TV: the QR + agenda idle screen — tied ONLY to the sleep window (or
	// "Sleep now"), never idle-timeout. TV has no touch input at all, so
	// idle-by-inactivity would go true a few minutes after boot and never
	// clear again, which is why this used to show nearly around the clock
	// instead of the calendar dashboard being the default daytime view.
	// Also gated on nobody actively driving it from a phone, since the live
	// dashboard following their navigation is what's useful to show then.
	const tvIdleActive = $derived(
		family.isTv &&
			tick >= snoozedUntil &&
			(screensaver.forceSleep || sleepActive) &&
			!mirror.controllerConnected
	);
	// Touch: the original idle-timeout-or-sleep-window dismissible screensaver, unchanged.
	const touchScreensaverActive = $derived(
		!family.isTv &&
			tick >= snoozedUntil &&
			(screensaver.forceSleep || (sv.enabled && (sleepActive || idleActive)))
	);

	// --- Periodic Vestaboard flourish ---
	// A brief ambient interruption (weather / upcoming events / kid streaks /
	// jokes / headlines / birthdays) on top of the daytime calendar
	// dashboard — every 5 min, for 10 sec — so there's always something
	// fresh to glance at without anyone having to go looking for it. Never
	// while the screensaver/idle screen is already showing (that one stays
	// put once it's on) or while a phone is actively driving the display.
	// The timer still runs underneath either way; it just won't render.
	const FLOURISH_EVERY_MS = 5 * 60_000;
	const FLOURISH_DURATION_MS = 10_000;
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
	const flourishActive = $derived(
		showFlourish && !mirror.controllerConnected && !tvIdleActive && !touchScreensaverActive
	);

	// --- Auto light/dark theme (sunrise/sunset ±1h) ---
	// Set on <html>, not the .app div — TvIdleScreen/Screensaver render as
	// siblings of .app, not children, so a document-level attribute is the
	// only way every overlay picks up the same theme tokens.
	const theme = $derived(isDarkNow(new Date(tick), family.latitude, family.longitude) ? 'dark' : 'light');
	$effect(() => {
		document.documentElement.dataset.theme = theme;
	});

	// --- Dim after long inactivity (screen-burn / just-being-considerate) ---
	// A separate, longer threshold from the idle screensaver above — it can
	// layer on top of the QR idle screen or the regular dashboard alike.
	const DIM_AFTER_MS = 30 * 60_000;
	const dimActive = $derived(tick - lastActivity > DIM_AFTER_MS);
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

<!-- Full QR on a TV (the only way in), a small icon on a touchscreen. Stays
     mounted through the flourish too — Vestaboard's own z-index sits below
     it deliberately, so the QR (or its badge) stays reachable throughout. -->
{#if !tvIdleActive && !touchScreensaverActive}
	<PhoneMirrorPanel />
{/if}

{#if flourishActive}
	<Vestaboard ondismiss={() => (showFlourish = false)} />
{:else if tvIdleActive}
	<TvIdleScreen />
{:else if touchScreensaverActive}
	<Screensaver
		mode={sv.mode}
		ondismiss={() => {
			screensaver.forceSleep = false;
			lastActivity = Date.now();
			snoozedUntil = Date.now() + 10_000;
		}}
	/>
{/if}

<div class="dim-overlay" class:active={dimActive} aria-hidden="true"></div>

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

	/* Software brightness dim after long inactivity — HDMI TVs have no
	   backlight the Pi can drive, so this darkens the rendered picture
	   instead. pointer-events: none so a touch still reaches through to
	   count as activity and lift the dim. */
	.dim-overlay {
		position: fixed;
		inset: 0;
		background: #000;
		opacity: 0;
		pointer-events: none;
		z-index: 9999;
		transition: opacity 3s ease;
	}
	.dim-overlay.active {
		opacity: 0.55;
	}
</style>
