<script lang="ts">
	import { onMount } from 'svelte';
	import { Check, X, Plus, Settings } from 'lucide-svelte';
	import { loadConfig } from '$lib/stores/config.svelte';

	interface Chore {
		id: number;
		name: string;
		icon: string;
		starReward: number;
		frequency: string;
		dueTime?: string;
		assignedTo?: number;
		claimedAt?: number;
		completed: boolean;
		completedAt?: number;
		completedBy?: number;
	}

	let chores = $state<Chore[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let currentProfileId = $state(0);
	let showSettings = $state(false);
	let newChore = $state({ name: '', icon: '🎯', starReward: 10, frequency: 'daily', dueTime: '' });

	const profileColors: Record<number, string> = {
		1: '#fda6a6',
		2: '#c8d9e6',
		3: '#a8d8be',
		4: '#f0d9d9',
		5: '#ffe8b6',
		6: '#fdd9e5',
		7: '#d4e5f0',
		8: '#e8d9e8'
	};

	onMount(async () => {
		const cfg = await loadConfig();
		if (cfg.profiles.length > 0) currentProfileId = cfg.profiles[0].id;
		await loadChores();
	});

	async function loadChores() {
		loading = true;
		try {
			const res = await fetch('/api/chores');
			if (res.ok) {
				chores = await res.json();
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load chores';
		} finally {
			loading = false;
		}
	}

	async function addChore() {
		if (!newChore.name.trim()) return;
		try {
			const res = await fetch('/api/chores', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(newChore)
			});
			if (res.ok) {
				newChore = { name: '', icon: '🎯', starReward: 10, frequency: 'daily', dueTime: '' };
				showSettings = false;
				await loadChores();
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to create chore';
		}
	}

	async function claimChore(choreId: number) {
		try {
			const res = await fetch(`/api/chores/${choreId}/claim`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ profileId: currentProfileId })
			});
			if (res.ok) await loadChores();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to claim chore';
		}
	}

	async function unclaimChore(choreId: number) {
		try {
			const res = await fetch(`/api/chores/${choreId}/unclaim`, {
				method: 'POST'
			});
			if (res.ok) await loadChores();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to unclaim chore';
		}
	}

	async function completeChore(choreId: number) {
		try {
			const res = await fetch(`/api/chores/${choreId}/complete`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ profileId: currentProfileId })
			});
			if (res.ok) {
				const result = await res.json();
				error = `✓ +${result.starsAwarded} stars!`;
				setTimeout(() => (error = null), 2000);
				await loadChores();
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to complete chore';
		}
	}

	async function deleteChore(choreId: number) {
		if (!confirm('Delete this chore?')) return;
		try {
			const res = await fetch(`/api/chores/${choreId}`, { method: 'DELETE' });
			if (res.ok) await loadChores();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to delete chore';
		}
	}
</script>

<div class="board">
	<div class="header">
		<h2>📋 CHORES</h2>
		<button class="settings-btn" onclick={() => (showSettings = !showSettings)}>
			<Settings size={20} />
		</button>
	</div>

	{#if showSettings}
		<div class="settings-panel">
			<h3>Add New Chore</h3>
			<input type="text" placeholder="Chore name" bind:value={newChore.name} maxlength="120" />
			<input type="text" placeholder="Icon (emoji)" bind:value={newChore.icon} maxlength="8" />
			<input type="number" placeholder="Stars" bind:value={newChore.starReward} min="1" max="100" />
			<select bind:value={newChore.frequency}>
				<option value="once">Once</option>
				<option value="daily">Daily</option>
				<option value="weekly">Weekly</option>
			</select>
			<input type="time" placeholder="Due time" bind:value={newChore.dueTime} />
			<button class="add-btn" onclick={addChore}>+ Add Chore</button>
		</div>
	{/if}

	{#if loading}
		<p class="loading">Loading chores...</p>
	{:else if error}
		<p class="error">{error}</p>
	{/if}

	<div class="chores-grid">
		{#each chores as chore (chore.id)}
			{@const isCompleted = chore.completed}
			{@const isClaimedByMe = chore.assignedTo === currentProfileId}
			{@const isClaimedByOther = chore.assignedTo && chore.assignedTo !== currentProfileId}
			{@const bgColor = isClaimedByMe ? profileColors[currentProfileId] : '#f5f5f5'}

			<div class="chore-card" style:background-color={bgColor} class:completed={isCompleted}>
				<div class="chore-header">
					<span class="icon">{chore.icon}</span>
					<span class="name">{chore.name}</span>
				</div>

				<div class="chore-reward">
					⭐ {chore.starReward} stars
				</div>

				<div class="chore-status">
					{#if isCompleted}
						<span class="status-badge done">✓ Completed</span>
					{:else if isClaimedByMe}
						<span class="status-badge claimed-me">In Progress</span>
					{:else if isClaimedByOther}
						<span class="status-badge claimed-other">Claimed</span>
					{:else}
						<span class="status-badge available">Available</span>
					{/if}
				</div>

				<div class="chore-actions">
					{#if isCompleted}
						<button class="action-btn done-btn" disabled>✓ Done</button>
					{:else if isClaimedByMe}
						<button class="action-btn complete-btn" onclick={() => completeChore(chore.id)}>
							Mark Done
						</button>
						<button class="action-btn unclaim-btn" onclick={() => unclaimChore(chore.id)}>
							Unclaim
						</button>
					{:else if isClaimedByOther}
						<button class="action-btn" disabled>Claimed by other</button>
					{:else}
						<button class="action-btn claim-btn" onclick={() => claimChore(chore.id)}>
							Claim
						</button>
					{/if}
					<button class="action-btn delete-btn" onclick={() => deleteChore(chore.id)}>
						<X size={16} />
					</button>
				</div>
			</div>
		{/each}
	</div>
</div>

<style>
	.board {
		padding: var(--space-4);
		background: white;
		border-radius: var(--radius-lg);
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--space-4);
	}

	.header h2 {
		margin: 0;
		font-size: var(--text-xl);
	}

	.settings-btn {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border-radius: var(--radius-pill);
		background: var(--color-surface-elevated);
		border: none;
		cursor: pointer;
	}

	.settings-btn:hover {
		background: var(--color-surface-hover);
	}

	.settings-panel {
		background: var(--color-surface-elevated);
		border-radius: var(--radius-md);
		padding: var(--space-3);
		margin-bottom: var(--space-4);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.settings-panel h3 {
		margin: 0 0 var(--space-2) 0;
	}

	.settings-panel input,
	.settings-panel select {
		padding: 8px 12px;
		border: 1px solid var(--color-border-subtle);
		border-radius: var(--radius-sm);
		font-size: var(--text-sm);
	}

	.add-btn {
		padding: 10px 16px;
		background: var(--color-text-primary);
		color: white;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-weight: var(--weight-semibold);
	}

	.add-btn:hover {
		opacity: 0.9;
	}

	.loading,
	.error {
		text-align: center;
		padding: var(--space-3);
		color: var(--color-text-secondary);
	}

	.error {
		background: rgba(255, 59, 48, 0.1);
		color: #ff3b30;
		border-radius: var(--radius-sm);
	}

	.chores-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: var(--space-3);
	}

	.chore-card {
		border-radius: var(--radius-md);
		padding: var(--space-3);
		border: 1px solid var(--color-border-subtle);
		transition: all 0.2s;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.chore-card:hover {
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		transform: translateY(-2px);
	}

	.chore-card.completed {
		background: #e8f5e9 !important;
		opacity: 0.8;
	}

	.chore-header {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.icon {
		font-size: 28px;
		flex: none;
	}

	.name {
		font-weight: var(--weight-semibold);
		font-size: var(--text-base);
		color: var(--color-text-primary);
	}

	.chore-reward {
		font-size: var(--text-sm);
		font-weight: var(--weight-semibold);
		color: var(--color-text-secondary);
	}

	.chore-status {
		display: flex;
		gap: var(--space-1);
	}

	.status-badge {
		display: inline-block;
		padding: 4px 10px;
		border-radius: var(--radius-pill);
		font-size: 11px;
		font-weight: var(--weight-semibold);
		text-transform: uppercase;
	}

	.status-badge.available {
		background: #e3f2fd;
		color: #1976d2;
	}

	.status-badge.claimed-me {
		background: #fff3e0;
		color: #f57c00;
	}

	.status-badge.claimed-other {
		background: #f3e5f5;
		color: #7b1fa2;
	}

	.status-badge.done {
		background: #e8f5e9;
		color: #388e3c;
	}

	.chore-actions {
		display: flex;
		gap: var(--space-2);
		margin-top: var(--space-1);
	}

	.action-btn {
		flex: 1;
		padding: 8px 12px;
		border: none;
		border-radius: var(--radius-sm);
		font-size: var(--text-sm);
		font-weight: var(--weight-semibold);
		cursor: pointer;
		transition: all 0.2s;
	}

	.action-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.claim-btn {
		background: #ff8a65;
		color: white;
	}

	.claim-btn:hover:not(:disabled) {
		background: #ff7043;
	}

	.complete-btn {
		background: #66bb6a;
		color: white;
	}

	.complete-btn:hover {
		background: #43a047;
	}

	.unclaim-btn {
		background: var(--color-surface-elevated);
		color: var(--color-text-secondary);
	}

	.unclaim-btn:hover {
		background: var(--color-surface-hover);
	}

	.delete-btn {
		background: transparent;
		color: var(--color-text-tertiary);
		padding: 8px;
	}

	.delete-btn:hover {
		color: #ff3b30;
	}

	.done-btn {
		background: #e8f5e9;
		color: #388e3c;
	}
</style>
