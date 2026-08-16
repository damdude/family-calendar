<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { family } from '$lib/stores/family.svelte';
	import Avatar from '$lib/components/Avatar.svelte';
	import StarTally from '$lib/components/StarTally.svelte';
	import { ArrowLeft } from 'lucide-svelte';

	const id = $derived(Number(page.params.id));
	const kid = $derived(family.profile(id));
	const stars = $derived(kid ? family.starsFor(id) : 0);
	const next = $derived(kid ? family.nextReward(id) : undefined);
	const affordable = $derived(
		kid
			? family.data.rewards
					.filter((r) => r.active && r.starCost <= stars)
					.sort((a, b) => b.starCost - a.starCost)
			: []
	);
	const claims = $derived(kid ? family.claimsFor(id) : []);

	let justClaimed = $state('');
	let toastTimer: ReturnType<typeof setTimeout>;
	function claim(rewardId: number, name: string) {
		if (family.claimReward(rewardId, id)) {
			justClaimed = `Claimed ${name}!`;
			clearTimeout(toastTimer);
			toastTimer = setTimeout(() => (justClaimed = ''), 2600);
		}
	}

	function claimDate(ts: number) {
		return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}
</script>

<div class="detail-page">
	<button type="button" class="back" onclick={() => goto('/rewards')}>
		<ArrowLeft size={18} /> Rewards
	</button>

	{#if !kid}
		<p class="type-body">No child found.</p>
	{:else}
		<header class="hero">
			<Avatar profile={kid} size={80} />
			<div>
				<h1 class="type-title name">{kid.name}</h1>
				<StarTally {stars} size="lg" />
			</div>
		</header>

		<section class="card next">
			<h2 class="type-heading">Next reward</h2>
			{#if next}
				<div class="nextrow">
					<span class="bigicon">{next.icon}</span>
					<div class="nextmeta">
						<span class="type-body-lg">{next.name}</span>
						<span class="type-caption sub"
							>{next.starCost} ⭐ · {next.starCost - stars} more to go</span
						>
					</div>
				</div>
				<div class="bar">
					<div class="fill" style="width:{Math.min(100, (stars / next.starCost) * 100)}%"></div>
				</div>
			{:else}
				<p class="type-body sub">Every reward is within reach right now — great work! 🌟</p>
			{/if}
		</section>

		{#if affordable.length}
			<section class="card">
				<h2 class="type-heading">Ready to claim</h2>
				<ul class="claimlist">
					{#each affordable as r (r.id)}
						<li class="claimrow">
							<span class="ricon">{r.icon}</span>
							<span class="type-body rname">{r.name}</span>
							<span class="cost type-caption">{r.starCost} ⭐</span>
							<button
								type="button"
								class="claimbtn"
								disabled={family.readOnly}
								onclick={() => claim(r.id, r.name)}>Claim</button
							>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<section class="card">
			<h2 class="type-heading">Rewards received <span class="count">{claims.length}</span></h2>
			{#if claims.length === 0}
				<p class="type-body sub">No rewards claimed yet.</p>
			{:else}
				<ul class="history">
					{#each claims as c (c.id)}
						<li class="histrow">
							<span class="ricon">{c.icon}</span>
							<span class="type-body rname">{c.rewardName}</span>
							<span class="cost type-caption">{c.starCost} ⭐ · {claimDate(c.ts)}</span>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}

	{#if justClaimed}
		<div class="toast" role="status">🎉 {justClaimed}</div>
	{/if}
</div>

<style>
	.detail-page {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding-top: var(--space-2);
		max-width: 640px;
	}
	.back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		align-self: flex-start;
		color: var(--color-text-secondary);
		font-weight: var(--weight-medium);
	}
	.hero {
		display: flex;
		align-items: center;
		gap: var(--space-4);
	}
	.name {
		color: var(--color-text-primary);
		margin-bottom: 4px;
	}
	.card {
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-card);
		padding: var(--space-5);
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.sub {
		color: var(--color-text-secondary);
	}
	.nextrow {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.bigicon {
		font-size: 2.4rem;
	}
	.nextmeta {
		display: flex;
		flex-direction: column;
		gap: 2px;
		color: var(--color-text-primary);
	}
	.bar {
		height: 10px;
		border-radius: var(--radius-pill);
		background: var(--color-surface-elevated);
		overflow: hidden;
	}
	.fill {
		height: 100%;
		background: var(--color-accent-gold);
		border-radius: var(--radius-pill);
		transition: width 0.4s ease;
	}
	.claimlist,
	.history {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.claimrow,
	.histrow {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.ricon {
		font-size: 1.5rem;
	}
	.rname {
		flex: 1;
		color: var(--color-text-primary);
	}
	.cost {
		color: var(--color-text-secondary);
	}
	.claimbtn {
		padding: 7px 16px;
		border-radius: var(--radius-pill);
		background: var(--color-accent-success);
		color: white;
		font-weight: var(--weight-semibold);
	}
	.claimbtn:disabled {
		opacity: 0.4;
	}
	.count {
		font-size: var(--text-sm);
		color: var(--color-text-tertiary);
		font-weight: var(--weight-medium);
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
