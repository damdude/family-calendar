<script lang="ts">
	import { family } from '$lib/stores/family.svelte';
	import Avatar from '$lib/components/Avatar.svelte';
	import StarTally from '$lib/components/StarTally.svelte';

	// Children who participate in the rewards economy.
	const kids = $derived(
		family.profiles.filter((p) => family.data.stars.some((s) => s.profileId === p.id))
	);
	const ladder = $derived(
		family.data.rewards.filter((r) => r.active).sort((a, b) => a.starCost - b.starCost)
	);
</script>

<div class="rewards-page">
	<h1 class="type-title page-title">Rewards</h1>

	<section class="stars-row">
		{#each kids as kid (kid.id)}
			{@const stars = family.starsFor(kid.id)}
			<div class="kidcard">
				<Avatar profile={kid} size={56} />
				<div class="kidmeta">
					<span class="type-body-lg name">{kid.name}</span>
					<StarTally {stars} size="lg" />
				</div>
			</div>
		{/each}
	</section>

	<section class="ladder">
		<h2 class="type-heading">Reward Ladder</h2>
		<ul>
			{#each ladder as reward (reward.id)}
				<li class="rung">
					<span class="ricon">{reward.icon}</span>
					<div class="rmain">
						<span class="rname type-body-lg">{reward.name}</span>
						<span class="cost type-caption">{reward.starCost} ⭐</span>
					</div>
					<div class="claims">
						{#each kids as kid (kid.id)}
							{@const stars = family.starsFor(kid.id)}
							{@const canClaim = stars >= reward.starCost}
							<span class="chip" class:can={canClaim}>
								<Avatar profile={kid} size={20} ring={false} />
								{#if canClaim}
									<span class="type-caption">Claim</span>
								{:else}
									<span class="type-caption">{reward.starCost - stars} to go</span>
								{/if}
							</span>
						{/each}
					</div>
				</li>
			{/each}
		</ul>
	</section>
</div>

<style>
	.rewards-page {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
		padding-top: var(--space-2);
	}
	.page-title {
		color: var(--color-text-primary);
	}
	.stars-row {
		display: flex;
		gap: var(--space-4);
		flex-wrap: wrap;
	}
	.kidcard {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-4) var(--space-5);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		box-shadow: var(--shadow-card);
	}
	.kidmeta {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.name {
		color: var(--color-text-primary);
	}
	.ladder {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.ladder ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.rung {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		box-shadow: var(--shadow-card);
	}
	.ricon {
		font-size: 1.9rem;
	}
	.rmain {
		flex: 1;
		display: flex;
		flex-direction: column;
	}
	.rname {
		color: var(--color-text-primary);
	}
	.cost {
		color: var(--color-text-secondary);
	}
	.claims {
		display: flex;
		gap: var(--space-2);
		flex-wrap: wrap;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px 4px 4px;
		border-radius: var(--radius-pill);
		background: var(--color-surface-elevated);
		color: var(--color-text-tertiary);
	}
	.chip.can {
		background: color-mix(in srgb, var(--color-accent-success) 22%, white);
		color: #10391f;
	}
</style>
