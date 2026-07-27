<script lang="ts">
	import type { Profile } from '$lib/types';
	import { family } from '$lib/stores/family.svelte';
	import { profileTint } from '$lib/design/colors';
	import Avatar from '$lib/components/Avatar.svelte';
	import RoutineCard from '$lib/components/RoutineCard.svelte';
	import ProfileAgenda from '$lib/components/ProfileAgenda.svelte';
	import StarTally from '$lib/components/StarTally.svelte';
	import StreakBadge from '$lib/components/StreakBadge.svelte';

	let { profile }: { profile: Profile } = $props();

	const routines = $derived(family.routinesForProfile(profile.id));
	const stars = $derived(family.starsFor(profile.id));
	const bestStreak = $derived(Math.max(0, ...routines.map((r) => r.streak.current)));
	const feeling = $derived(family.feelingFor(profile.id));

	// Nearest reward the child can aim for.
	const nextReward = $derived(
		family.data.rewards
			.filter((r) => r.active && r.starCost > stars)
			.sort((a, b) => a.starCost - b.starCost)[0]
	);
</script>

<div
	class="kid type-rounded"
	style:background="linear-gradient(180deg, {profileTint(profile.color, 20)}, transparent 220px)"
>
	<header class="phead">
		<Avatar {profile} size={80} />
		<div class="idn">
			<h1 class="type-title-lg">{profile.name}</h1>
			<div class="badges">
				<StarTally {stars} size="md" />
				<StreakBadge current={bestStreak} size="md" />
				{#if feeling}<span class="feeling">{feeling.emoji} {feeling.label}</span>{/if}
			</div>
		</div>
	</header>

	<section class="block">
		<h2 class="type-heading">My Routines</h2>
		<div class="routines">
			{#each routines as r (r.id)}
				<RoutineCard routine={r} />
			{/each}
		</div>
	</section>

	{#if nextReward}
		<section class="panel reward">
			<div>
				<h2 class="type-heading">Next reward</h2>
				<p class="type-body-lg rname">{nextReward.icon} {nextReward.name}</p>
			</div>
			<div class="rprog">
				<span class="track"
					><span class="fill" style:width="{(stars / nextReward.starCost) * 100}%"></span></span
				>
				<span class="type-label need">{nextReward.starCost - stars} more ⭐</span>
			</div>
		</section>
	{/if}

	<section class="block">
		<h2 class="type-heading">Coming up</h2>
		<ProfileAgenda profileId={profile.id} days={7} />
	</section>
</div>

<style>
	.kid {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
		padding-top: var(--space-2);
	}
	.phead {
		display: flex;
		align-items: center;
		gap: var(--space-4);
	}
	.badges {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		margin-top: 4px;
	}
	.feeling {
		font-size: var(--text-lg);
		font-weight: var(--weight-semibold);
		color: var(--color-text-secondary);
	}
	.block {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.routines {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		gap: var(--space-3);
	}
	.panel {
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-card);
		padding: var(--space-5);
	}
	.reward {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-5);
		flex-wrap: wrap;
	}
	.rname {
		color: var(--color-text-primary);
		margin-top: 2px;
	}
	.rprog {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		flex: 1;
		min-width: 200px;
	}
	.track {
		flex: 1;
		height: 12px;
		border-radius: var(--radius-pill);
		background: var(--color-surface-elevated);
		overflow: hidden;
		box-shadow: inset 0 0 0 1px var(--color-border-subtle);
	}
	.fill {
		display: block;
		height: 100%;
		background: var(--color-accent-gold);
		border-radius: var(--radius-pill);
		transition: width var(--dur-standard) var(--ease-out);
	}
	.need {
		color: var(--color-text-secondary);
		white-space: nowrap;
	}
</style>
