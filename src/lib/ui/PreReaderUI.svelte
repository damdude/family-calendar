<script lang="ts">
	import type { Profile } from '$lib/types';
	import { family } from '$lib/stores/family.svelte';
	import { profileColorVar, profileTint } from '$lib/design/colors';
	import Avatar from '$lib/components/Avatar.svelte';
	import RoutineIcon from '$lib/icons/RoutineIcon.svelte';

	let { profile }: { profile: Profile } = $props();

	const routines = $derived(family.routinesForProfile(profile.id));
	const stars = $derived(family.starsFor(profile.id));
	const feeling = $derived(family.feelingFor(profile.id));
</script>

<!-- Pre-reader: icon-first, no reading required, ≥96px touch targets. -->
<div
	class="pre"
	style:background="linear-gradient(180deg, {profileTint(profile.color, 26)}, transparent 260px)"
>
	<header class="phead">
		<Avatar {profile} size={112} />
		<h1 class="type-title-xl type-rounded">{profile.name}</h1>
		{#if feeling}<div class="feeling type-rounded">{feeling.emoji}</div>{/if}
	</header>

	<div class="tiles">
		{#each routines as r (r.id)}
			<a
				class="tile pressable"
				href="/routine/{r.id}"
				style:--accent={profileColorVar(profile.color)}
				aria-label="{r.name} for {profile.name}"
			>
				<span class="ticon"
					><RoutineIcon icon={r.timeOfDay === 'evening' ? 'moon' : 'sun'} size={72} /></span
				>
				<span class="dots" aria-hidden="true">
					{#each r.steps as s (s.id)}
						<span class="dot" class:on={s.done}></span>
					{/each}
				</span>
			</a>
		{/each}
	</div>

	<div class="stars" aria-label="{stars} stars">
		{#each Array(Math.min(stars, 10)) as _, i (i)}
			<span class="star">⭐</span>
		{/each}
		{#if stars > 10}<span class="more type-rounded">+{stars - 10}</span>{/if}
	</div>
</div>

<style>
	.pre {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-6);
		padding: var(--space-4) 0 var(--space-8);
		text-align: center;
	}
	.phead {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
	}
	.feeling {
		font-size: 3rem;
		line-height: 1;
	}
	.tiles {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-5);
		justify-content: center;
	}
	.tile {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3);
		width: 168px;
		height: 168px;
		justify-content: center;
		border-radius: var(--radius-xl);
		background: var(--color-surface);
		box-shadow: var(--shadow-raised);
	}
	.ticon {
		display: grid;
		place-items: center;
		width: 104px;
		height: 104px;
		border-radius: var(--radius-lg);
		color: color-mix(in srgb, var(--accent) 62%, var(--color-text-primary));
		background: color-mix(in srgb, var(--accent) 42%, var(--color-surface));
	}
	.dots {
		display: flex;
		gap: 8px;
	}
	.dot {
		width: 12px;
		height: 12px;
		border-radius: var(--radius-pill);
		background: var(--color-border-subtle);
	}
	.dot.on {
		background: var(--color-accent-success);
	}
	.stars {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		justify-content: center;
		align-items: center;
		font-size: 2rem;
	}
	.more {
		font-size: 1.4rem;
		font-weight: var(--weight-bold);
		color: var(--color-text-secondary);
	}
</style>
