<script lang="ts">
	import { family } from '$lib/stores/family.svelte';
	import { formatClock } from '$lib/time';

	let { mode }: { mode: 'clock' | 'photos' } = $props();

	// Live clock.
	let now = $state(new Date());
	$effect(() => {
		const id = setInterval(() => (now = new Date()), 1000);
		return () => clearInterval(id);
	});

	const timeStr = $derived(formatClock(now, family.config.view.clock24h));
	const dateStr = $derived(
		now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
	);

	// Next upcoming event.
	const nextEvent = $derived(
		[...family.data.events]
			.filter((e) => e.end.getTime() > now.getTime())
			.sort((a, b) => a.start.getTime() - b.start.getTime())[0]
	);
	function evtTime(d: Date) {
		return formatClock(d, family.config.view.clock24h);
	}

	const bestStreak = $derived(Math.max(0, ...family.data.routines.map((r) => r.streak.current)));

	// Photo rotation — profiles that have an uploaded photo.
	const photoProfiles = $derived(family.profiles.filter((p) => p.photoUpdatedAt));
	let photoIndex = $state(0);
	$effect(() => {
		if (mode !== 'photos' || photoProfiles.length === 0) return;
		const id = setInterval(() => {
			photoIndex = (photoIndex + 1) % photoProfiles.length;
		}, 8000);
		return () => clearInterval(id);
	});
	const showPhotos = $derived(mode === 'photos' && photoProfiles.length > 0);
	const current = $derived(photoProfiles[photoIndex % Math.max(1, photoProfiles.length)]);
</script>

<div class="saver" class:photos={showPhotos}>
	{#if showPhotos && current}
		<img
			class="bg"
			src="/media/avatar/{current.id}?v={current.photoUpdatedAt}"
			alt=""
			aria-hidden="true"
		/>
		<div class="scrim"></div>
		<div class="overlay">
			<time class="clock-sm">{timeStr}</time>
			<span class="name-sm">{current.name}</span>
		</div>
	{:else}
		<div class="clockface">
			<time class="clock">{timeStr}</time>
			<p class="date">{dateStr}</p>
			<div class="info">
				<span class="chip">{family.data.weather.icon} {family.data.weather.tempF}°</span>
				{#if bestStreak > 0}<span class="chip">🔥 {bestStreak}-day streak</span>{/if}
			</div>
			{#if nextEvent}
				<p class="next">
					Next: <strong>{nextEvent.title}</strong> · {evtTime(nextEvent.start)}
				</p>
			{/if}
		</div>
	{/if}
</div>

<style>
	.saver {
		position: fixed;
		inset: 0;
		z-index: 200;
		background: var(--color-screensaver-bg);
		color: var(--color-screensaver-fg);
		display: grid;
		place-items: center;
		overflow: hidden;
	}
	.bg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		filter: grayscale(1) contrast(1.05);
	}
	.scrim {
		position: absolute;
		inset: 0;
		background: linear-gradient(180deg, rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.7));
	}
	.overlay {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 8%;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		z-index: 1;
	}
	.clock-sm {
		font-size: clamp(3rem, 9vw, 6rem);
		font-weight: 200;
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.02em;
	}
	.name-sm {
		font-size: var(--text-xl);
		opacity: 0.8;
	}
	.clockface {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-4);
		text-align: center;
	}
	.clock {
		font-size: clamp(4rem, 18vw, 14rem);
		font-weight: 200;
		line-height: 1;
		letter-spacing: -0.03em;
		font-variant-numeric: tabular-nums;
	}
	.date {
		font-size: clamp(1.2rem, 3vw, 2rem);
		font-weight: 300;
		opacity: 0.8;
	}
	.info {
		display: flex;
		gap: var(--space-4);
		margin-top: var(--space-2);
	}
	.chip {
		font-size: var(--text-lg);
		opacity: 0.85;
	}
	.next {
		margin-top: var(--space-4);
		font-size: var(--text-lg);
		opacity: 0.7;
	}
	.next strong {
		font-weight: var(--weight-semibold);
		opacity: 1;
	}
</style>
