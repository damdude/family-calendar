<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import { family } from '$lib/stores/family.svelte';
	import { profileColorVar, profileTint } from '$lib/design/colors';
	import { dateKey } from '$lib/time';
	import type { Feeling } from '$lib/types';
	import type { PageData } from './$types';
	import Avatar from '$lib/components/Avatar.svelte';
	import RoutineStepCard from '$lib/components/RoutineStepCard.svelte';
	import StreakBadge from '$lib/components/StreakBadge.svelte';
	import StarTally from '$lib/components/StarTally.svelte';
	import FeelingsPicker from '$lib/components/FeelingsPicker.svelte';
	import Confetti from '$lib/components/Confetti.svelte';
	import { ArrowLeft } from 'lucide-svelte';

	let { data }: { data: PageData } = $props();

	// Hydrate the store from persisted config + progress (covers a direct load
	// of this full-screen route). untrack the mutations so the effect depends
	// only on the load data, not the store state it writes (avoids a loop).
	$effect(() => {
		const { config, progress } = data;
		untrack(() => {
			family.applyConfig(config);
			family.applyProgress(progress);
		});
	});

	const routineId = $derived(Number(page.params.id));
	const routine = $derived(family.routine(routineId));
	const profile = $derived(routine ? family.profile(routine.profileId) : undefined);
	const showText = $derived((profile?.age ?? 18) >= 5);

	const total = $derived(routine?.steps.length ?? 0);
	const doneCount = $derived(routine?.steps.filter((s) => s.done).length ?? 0);
	const allDone = $derived(total > 0 && doneCount === total);
	const progress = $derived(total ? (doneCount / total) * 100 : 0);

	// Toggle a step, then persist the day's completion set and sync the streak
	// (and star balance, when this toggle is what completed the routine).
	async function onToggle(stepId: number) {
		family.toggleStep(routineId, stepId);
		try {
			const res = await fetch(`/api/routine/${routineId}`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					date: dateKey(),
					doneStepIds: family.doneStepIds(routineId),
					total,
					profileId: routine?.profileId
				})
			});
			if (res.ok) {
				const p = await res.json();
				family.setStreak(routineId, p.streakCurrent, p.streakLongest, p.lastCompletedDate);
				if (p.stars !== undefined && profile) family.setStars(profile.id, p.stars);
			}
		} catch {
			/* offline; next toggle re-syncs */
		}
	}

	// Celebrate once when the routine flips to fully complete.
	let awarded = $state(false);
	let celebrating = $state(false);
	$effect(() => {
		if (allDone && !awarded) {
			awarded = true;
			celebrating = celebrating || family.config.celebrations;
			if (family.config.celebrations) setTimeout(() => (celebrating = false), 2800);
		} else if (!allDone) {
			awarded = false;
		}
	});

	const stars = $derived(profile ? family.starsFor(profile.id) : 0);
	const streakNow = $derived(routine?.streak.current ?? 0);
	// A milestone lands on multiples of 5 (only celebrated when just completed).
	const milestone = $derived(awarded && streakNow > 0 && streakNow % 5 === 0);

	// Today's Feelings (morning routines) — seeded from persisted state.
	let feeling = $state<Feeling | undefined>(undefined);
	$effect(() => {
		const existing = profile ? family.feelingFor(profile.id) : undefined;
		if (existing && !feeling) feeling = { emoji: existing.emoji, label: existing.label };
	});

	async function saveFeeling(f: Feeling) {
		if (!profile) return;
		family.setFeelingToday(profile.id, f.emoji, f.label);
		try {
			await fetch('/api/feeling', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					profileId: profile.id,
					date: dateKey(),
					emoji: f.emoji,
					label: f.label
				})
			});
		} catch {
			/* offline */
		}
	}
</script>

{#if !routine || !profile}
	<div class="missing">
		<p class="type-title">Routine not found</p>
		<a class="back-link type-body-lg" href="/">← Back to calendar</a>
	</div>
{:else}
	<div
		class="screen"
		style:--accent={profileColorVar(profile.color)}
		style:background="linear-gradient(180deg, {profileTint(profile.color, 22)} 0%, var(--color-canvas)
		40%)"
	>
		<Confetti active={celebrating} />

		<header class="head">
			<a class="back pressable" href="/profile/{profile.id}" aria-label="Back to {profile.name}">
				<ArrowLeft size={22} />
			</a>
			<div class="who">
				<Avatar {profile} size={64} />
				<div class="titles">
					<h1 class="type-title-lg name">{profile.name}</h1>
					<p class="type-heading routine-name">{routine.name}</p>
				</div>
			</div>
			<div class="stats">
				<StreakBadge current={streakNow} size="lg" />
				<StarTally {stars} size="lg" />
			</div>
		</header>

		<div class="progress" role="progressbar" aria-valuenow={doneCount} aria-valuemax={total}>
			<div class="bar" style:width="{progress}%"></div>
			<span class="count type-label">{doneCount} / {total}</span>
		</div>

		{#if awarded}
			<div class="celebrate type-rounded">
				<span class="big">🎉 Great job, {profile.name}!</span>
				{#if milestone}
					<span class="sub type-body-lg">🔥 {streakNow}-day streak — amazing!</span>
				{:else}
					<span class="sub type-body-lg">You earned a star and grew your streak!</span>
				{/if}
			</div>
		{/if}

		<ul class="steps" class:iconlayout={!showText}>
			{#each routine.steps as step (step.id)}
				<li>
					<RoutineStepCard
						{step}
						color={profile.color}
						{showText}
						onToggle={() => onToggle(step.id)}
					/>
				</li>
			{/each}
		</ul>

		{#if routine.timeOfDay === 'morning' && family.config.features.feelings}
			<section class="feelings-block">
				<h2 class="type-heading">How are you feeling today?</h2>
				<FeelingsPicker bind:selected={feeling} onpick={saveFeeling} />
			</section>
		{/if}
	</div>
{/if}

<style>
	.screen {
		min-height: 100vh;
		padding: var(--space-5) var(--space-5) var(--space-8);
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
		align-items: center;
	}
	.head,
	.progress,
	.steps,
	.feelings-block,
	.celebrate {
		width: min(640px, 100%);
	}
	.head {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: var(--space-4);
	}
	.back {
		display: grid;
		place-items: center;
		width: 48px;
		height: 48px;
		border-radius: var(--radius-pill);
		background: var(--color-surface);
		box-shadow: var(--shadow-card);
		color: var(--color-text-primary);
	}
	.who {
		display: flex;
		align-items: center;
		gap: var(--space-4);
	}
	.name {
		color: var(--color-text-primary);
	}
	.routine-name {
		color: var(--color-text-secondary);
	}
	.stats {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: var(--space-2);
	}
	.progress {
		position: relative;
		height: 16px;
		border-radius: var(--radius-pill);
		background: var(--color-surface);
		box-shadow: inset 0 0 0 1px var(--color-border-subtle);
		display: flex;
		align-items: center;
	}
	.bar {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		border-radius: var(--radius-pill);
		background: var(--accent);
		transition: width var(--dur-standard) var(--ease-out);
	}
	.count {
		position: absolute;
		right: 10px;
		color: var(--color-text-secondary);
		font-variant-numeric: tabular-nums;
		mix-blend-mode: multiply;
	}
	.celebrate {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		text-align: center;
		padding: var(--space-4);
		border-radius: var(--radius-lg);
		background: color-mix(in srgb, var(--color-accent-gold) 18%, white);
		box-shadow: var(--shadow-card);
	}
	.celebrate .big {
		font-size: var(--text-2xl);
		font-weight: var(--weight-bold);
		color: var(--color-text-primary);
	}
	.celebrate .sub {
		color: var(--color-text-secondary);
	}
	.steps {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.steps.iconlayout {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: var(--space-3);
	}
	.feelings-block {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		align-items: center;
		text-align: center;
		margin-top: var(--space-2);
	}
	.missing {
		height: 100vh;
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		align-items: center;
		justify-content: center;
	}
	.back-link {
		color: var(--color-text-secondary);
	}
</style>
