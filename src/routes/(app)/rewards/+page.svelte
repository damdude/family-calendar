<script lang="ts">
	import { family } from '$lib/stores/family.svelte';
	import Avatar from '$lib/components/Avatar.svelte';
	import StarTally from '$lib/components/StarTally.svelte';
	import { Plus, Trash2, Settings, X } from 'lucide-svelte';

	const REWARD_ICONS = ['🎁', '🍦', '🎮', '🎬', '🍕', '🏖️', '📱', '🧸'];

	// Kids participate in the rewards economy by default — showing everyone
	// (even at 0 stars, before their first completed routine) rather than only
	// once they've already earned something, which used to make the whole
	// ladder look broken on a fresh install.
	const kids = $derived(family.profiles.filter((p) => p.role === 'child'));
	const ladder = $derived(
		family.data.rewards.filter((r) => r.active).sort((a, b) => a.starCost - b.starCost)
	);

	let justClaimed = $state('');
	let toastTimer: ReturnType<typeof setTimeout>;

	// --- Manage the reward ladder ---
	let managing = $state(false);
	let newName = $state('');
	let newIcon = $state('🎁');
	let newCost = $state<number | ''>('');
	function addReward() {
		if (!newName.trim() || newCost === '') return;
		family.addReward(newName, newIcon, Number(newCost));
		newName = '';
		newIcon = '🎁';
		newCost = '';
	}
</script>

<div class="rewards-page">
	<div class="pagehead">
		<h1 class="type-title page-title">Rewards</h1>
		<button type="button" class="managebtn" onclick={() => (managing = !managing)}>
			{#if managing}<X size={16} /> Done{:else}<Settings size={16} /> Manage{/if}
		</button>
	</div>

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

	{#if managing}
		<section class="managepane">
			<h2 class="type-heading">Manage rewards</h2>
			<ul class="manageList">
				{#each family.data.rewards as reward (reward.id)}
					<li class="mrow" class:inactive={!reward.active}>
						<span class="ricon">{reward.icon}</span>
						<input
							class="minput name"
							type="text"
							bind:value={reward.name}
							onchange={() => family.persistFamilyData()}
							maxlength="120"
						/>
						<input
							class="minput mcost"
							type="number"
							min="1"
							max="1000"
							bind:value={reward.starCost}
							onchange={() => family.persistFamilyData()}
						/>
						<button
							type="button"
							class="switch"
							class:on={reward.active}
							role="switch"
							aria-checked={reward.active}
							aria-label="Active"
							onclick={() => {
								reward.active = !reward.active;
								family.persistFamilyData();
							}}><span class="knob"></span></button
						>
						<button
							type="button"
							class="iconbtn danger"
							aria-label="Remove {reward.name}"
							onclick={() => family.removeReward(reward.id)}><Trash2 size={15} /></button
						>
					</li>
				{/each}
				{#if family.data.rewards.length === 0}
					<p class="type-body sub empty">No rewards yet — add one below.</p>
				{/if}
			</ul>
			<div class="addrow">
				<div class="chips">
					{#each REWARD_ICONS as a (a)}
						<button
							type="button"
							class="emojidot"
							class:on={newIcon === a}
							onclick={() => (newIcon = a)}>{a}</button
						>
					{/each}
				</div>
				<div class="row">
					<input class="minput name" type="text" placeholder="Reward name" bind:value={newName} maxlength="120" />
					<input class="minput mcost" type="number" placeholder="⭐" min="1" max="1000" bind:value={newCost} />
					<button type="button" class="addbtn" disabled={!newName.trim() || newCost === ''} onclick={addReward}
						><Plus size={16} /> Add</button
					>
				</div>
			</div>
		</section>
	{/if}

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
	.pagehead {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.managebtn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 14px;
		border-radius: var(--radius-pill);
		background: var(--color-surface);
		color: var(--color-text-secondary);
		box-shadow: var(--shadow-card);
		font-weight: var(--weight-medium);
		font-size: var(--text-sm);
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
	.managepane {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-4);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		box-shadow: var(--shadow-card);
	}
	.manageList {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.mrow {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-2);
		border-radius: var(--radius-md);
		background: var(--color-surface-elevated);
	}
	.mrow.inactive {
		opacity: 0.5;
	}
	.minput {
		padding: 8px 10px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-border-subtle);
		background: var(--color-surface);
		color: var(--color-text-primary);
	}
	.minput.name {
		flex: 1;
		min-width: 0;
	}
	.minput.mcost {
		width: 72px;
	}
	.empty {
		color: var(--color-text-tertiary);
	}
	.addrow {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding-top: var(--space-3);
		border-top: 1px solid var(--color-border-hairline);
	}
	.addrow .row {
		display: flex;
		gap: var(--space-2);
	}
	.emojidot {
		width: 32px;
		height: 32px;
		border-radius: var(--radius-pill);
		background: var(--color-surface-elevated);
		font-size: 1.1rem;
	}
	.emojidot.on {
		box-shadow: 0 0 0 2px var(--color-text-primary);
	}
	.addbtn {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 8px 14px;
		border-radius: var(--radius-pill);
		background: var(--color-text-primary);
		color: var(--color-surface);
		font-weight: var(--weight-semibold);
		white-space: nowrap;
	}
	.addbtn:disabled {
		opacity: 0.45;
	}
	.switch {
		width: 44px;
		height: 26px;
		border-radius: var(--radius-pill);
		background: var(--color-border-subtle);
		padding: 3px;
		display: flex;
		flex: none;
	}
	.switch.on {
		background: var(--color-accent-success);
		justify-content: flex-end;
	}
	.knob {
		width: 20px;
		height: 20px;
		border-radius: var(--radius-pill);
		background: white;
		box-shadow: var(--shadow-card);
	}
	.iconbtn {
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		border-radius: var(--radius-pill);
		background: var(--color-surface);
		color: var(--color-text-tertiary);
		flex: none;
	}
	.iconbtn.danger:active {
		color: var(--color-accent-warning);
	}
</style>
