<script lang="ts">
	import { family } from '$lib/stores/family.svelte';
	import { routinesOn } from '$lib/types';
	import Avatar from '$lib/components/Avatar.svelte';
	import StreakBadge from '$lib/components/StreakBadge.svelte';
	import { ChevronRight } from 'lucide-svelte';
</script>

<div class="routines-page">
	<h1 class="type-title page-title">Routines</h1>
	<p class="type-body sub">Pick someone to see their morning and evening routines.</p>

	<div class="people">
		{#each family.profiles as p (p.id)}
			{@const routines = family.routinesForProfile(p.id)}
			{@const bestStreak = Math.max(0, ...routines.map((r) => r.streak.current))}
			<a class="pcard" href="/profile/{p.id}">
				<Avatar profile={p} size={56} />
				<div class="pmeta">
					<span class="type-body-lg name">{p.name}</span>
					{#if routines.length}
						<span class="type-caption sub">
							{routines.length} routine{routines.length === 1 ? '' : 's'}
						</span>
					{:else if routinesOn(p)}
						<span class="type-caption sub">No routines yet</span>
					{:else}
						<span class="type-caption sub">Routines off</span>
					{/if}
				</div>
				{#if bestStreak > 0}
					<StreakBadge current={bestStreak} />
				{/if}
				<ChevronRight size={18} class="chev" />
			</a>
		{/each}
		{#if family.profiles.length === 0}
			<p class="type-body sub">Add people in Settings first.</p>
		{/if}
	</div>
</div>

<style>
	.routines-page {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding-top: var(--space-2);
	}
	.page-title {
		color: var(--color-text-primary);
	}
	.sub {
		color: var(--color-text-secondary);
	}
	.people {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.pcard {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		padding: var(--space-4) var(--space-5);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		box-shadow: var(--shadow-card);
		text-decoration: none;
		transition:
			transform 0.12s ease,
			box-shadow 0.12s ease;
	}
	.pcard:hover {
		transform: translateY(-2px);
		box-shadow: var(--shadow-float);
	}
	.pmeta {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.name {
		color: var(--color-text-primary);
	}
	.pcard :global(.chev) {
		color: var(--color-text-tertiary);
	}
</style>
