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

	let justClaimed = $state('');
	let toastTimer: ReturnType<typeof setTimeout>;
</script>

<div class="rewards-page">
	<h1 class="type-title page-title">Rewards</h1>

	<section class="stars-row">
		{#each kids as kid (kid.id)}
			{@const stars = family.starsFor(kid.id)}
			<a class="kidcard" href="/rewards/{kid.id}">
				<Avatar profile={kid} size={56} />
				<div class="kidmeta">
					<span class="type-body-lg name">{kid.name}</span>
					<StarTally {stars} size="lg" />
				</div>
			</a>
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
							<button
								type="button"
								class="chip"
								class:can={canClaim}
								disabled={!canClaim || family.readOnly}
								onclick={() => {
									if (family.claimReward(reward.id, kid.id)) {
										justClaimed = `${kid.name} claimed ${reward.name}!`;
										clearTimeout(toastTimer);
										toastTimer = setTimeout(() => (justClaimed = ''), 2600);
									}
								}}
							>
								<Avatar profile={kid} size={20} ring={false} />
								{#if canClaim}
									<span class="type-caption">Claim</span>
								{:else}
									<span class="type-caption">{reward.starCost - stars} to go</span>
								{/if}
							</button>
						{/each}
					</div>
				</li>
			{/each}
		</ul>
	</section>

	{#if justClaimed}
		<div class="toast" role="status">🎉 {justClaimed}</div>
	{/if}
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
		text-decoration: none;
		transition:
			transform 0.12s ease,
			box-shadow 0.12s ease;
	}
	.kidcard:hover {
		transform: translateY(-2px);
		box-shadow: var(--shadow-float);
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
		background: color-mix(in srgb, var(--color-accent-success) 22%, var(--color-surface));
		color: color-mix(in srgb, var(--color-accent-success) 55%, var(--color-text-primary));
		cursor: pointer;
	}
	.chip.can:hover:not(:disabled) {
		background: color-mix(in srgb, var(--color-accent-success) 40%, white);
	}
	.chip:disabled {
		cursor: default;
	}
	.toast {
		position: fixed;
		left: 50%;
		bottom: calc(var(--space-6) + var(--bottom-nav-clearance, 0px));
		transform: translateX(-50%);
		z-index: 120;
		padding: 12px 20px;
		border-radius: var(--radius-pill);
		background: var(--color-text-primary);
		color: var(--color-surface);
		font-weight: var(--weight-semibold);
		box-shadow: var(--shadow-float);
	}
</style>
