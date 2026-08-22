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
	import { formatClock, formatRange } from '$lib/time';
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
	const weather = $derived(family.data.weather);

	function dayLabel(d: Date): string {
		const today = new Date(now);
		today.setHours(0, 0, 0, 0);
		const that = new Date(d);
		that.setHours(0, 0, 0, 0);
		const diffDays = Math.round((that.getTime() - today.getTime()) / 86_400_000);
		if (diffDays === 0) return 'Today';
		if (diffDays === 1) return 'Tomorrow';
		return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
	}

	// The rest of what's coming up — not just tomorrow — so a glance at the
	// sleeping screen previews the days ahead without waking the display up.
	// Capped at a fixed count rather than a day window: a screensaver isn't
	// scrollable, so this bounds how tall the list gets regardless of how
	// busy the calendar is, and naturally spans however many days it takes
	// to fill that count on a quiet week.
	const AGENDA_MAX = 8;
	const upcomingGroups = $derived.by(() => {
		const upcoming = [...family.data.events]
			.filter((e) => e.end.getTime() > now.getTime())
			.sort((a, b) => a.start.getTime() - b.start.getTime())
			.slice(0, AGENDA_MAX);
		const groups: { label: string; events: typeof upcoming }[] = [];
		for (const e of upcoming) {
			const label = dayLabel(e.start);
			const last = groups[groups.length - 1];
			if (last && last.label === label) last.events.push(e);
			else groups.push({ label, events: [e] });
		}
		return groups;
	});
</script>

{#if showFlourish}
	<Vestaboard />
{:else}
	<div class="tvidle" role="status" aria-label="Waiting for a phone to connect">
		<div class="layout" style:transform="translate({pos.x}vmin, {pos.y}vmin)">
			<div class="top">
				{#if mirror.qrSvg}
					<div class="qr">
						<!-- eslint-disable-next-line svelte/no-at-html-tags -->
						{@html mirror.qrSvg}
					</div>
				{/if}
				<time class="clock">{formatClock(now, clock24)}</time>
				<p class="date">{dateStr}</p>
				{#if weather.icon !== '—'}
					<p class="weather">{weather.icon} {weather.tempF}° {weather.condition}</p>
				{/if}
				<p class="hint"><Smartphone size={18} /> Scan to add events, lists and more</p>
			</div>
			{#if upcomingGroups.length}
				<div class="agenda">
					{#each upcomingGroups as g (g.label)}
						<div class="agroup">
							<p class="agroup-head"><CalendarDays size={14} /> {g.label}</p>
							{#each g.events as e (e.id)}
								<div class="arow">
									<p class="atitle">{e.title}</p>
									<p class="ameta">
										{e.allDay ? 'All day' : formatRange(e.start, e.end, clock24)}{#if e.location}
											· {e.location}{/if}
									</p>
								</div>
							{/each}
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
		flex-direction: column;
		align-items: center;
		gap: clamp(18px, 3.2vmin, 40px);
		max-height: 92vh;
		transition: transform 3s ease-in-out;
	}
	.top {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: clamp(10px, 2vmin, 22px);
		text-align: center;
		flex: none;
	}
	.agenda {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: clamp(10px, 1.8vmin, 20px);
		text-align: center;
		width: clamp(260px, 34vmin, 460px);
		overflow: hidden;
	}
	.agroup {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: clamp(4px, 0.8vmin, 8px);
	}
	.agroup-head {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: clamp(0.7rem, 1.4vmin, 0.95rem);
		font-weight: 500;
		opacity: 0.55;
		margin: 0 0 clamp(2px, 0.6vmin, 6px);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.arow {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
	}
	.atitle {
		font-size: clamp(0.85rem, 1.7vmin, 1.15rem);
		font-weight: 500;
		margin: 0;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.ameta {
		font-size: clamp(0.7rem, 1.3vmin, 0.95rem);
		font-variant-numeric: tabular-nums;
		opacity: 0.55;
		margin: 0;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.qr {
		width: clamp(110px, 16vmin, 240px);
		height: clamp(110px, 16vmin, 240px);
		padding: clamp(8px, 1.3vmin, 16px);
		background: #fff;
		border-radius: clamp(8px, 1.3vmin, 16px);
	}
	.qr :global(svg) {
		width: 100%;
		height: 100%;
		display: block;
	}
	.clock {
		font-size: clamp(1.8rem, 5.5vmin, 4.2rem);
		font-weight: 200;
		line-height: 1;
		letter-spacing: -0.02em;
		font-variant-numeric: tabular-nums;
	}
	.date {
		font-size: clamp(0.9rem, 2vmin, 1.3rem);
		font-weight: 300;
		opacity: 0.75;
		margin: 0;
	}
	.weather {
		font-size: clamp(0.85rem, 1.8vmin, 1.2rem);
		font-weight: 400;
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
