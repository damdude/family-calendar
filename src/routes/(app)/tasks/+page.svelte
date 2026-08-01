<script lang="ts">
	import { family } from '$lib/stores/family.svelte';
	import Avatar from '$lib/components/Avatar.svelte';
	import { Check, Plus, X } from 'lucide-svelte';

	const tasks = $derived(family.data.tasks);
	const open = $derived(tasks.filter((t) => !t.done));
	const done = $derived(tasks.filter((t) => t.done));

	let text = $state('');
	let who = $state<number | ''>('');

	function add() {
		if (!text.trim()) return;
		family.addTask(text, who === '' ? undefined : Number(who));
		text = '';
	}
</script>

<div class="tasks-page">
	<h1 class="type-title page-title">Tasks</h1>

	{#if !family.readOnly}
		<div class="addbar">
			<input
				class="in"
				type="text"
				placeholder="Add a task…"
				bind:value={text}
				onkeydown={(e) => e.key === 'Enter' && add()}
			/>
			<select class="in who" bind:value={who}>
				<option value="">Anyone</option>
				{#each family.profiles as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
			</select>
			<button type="button" class="add" onclick={add}><Plus size={18} /> Add</button>
		</div>
	{/if}

	<ul class="list">
		{#each open as t (t.id)}
			{@const p = t.profileId ? family.profile(t.profileId) : undefined}
			<li class="task">
				<button
					type="button"
					class="chk"
					aria-label="Complete"
					disabled={family.readOnly}
					onclick={() => family.toggleTask(t.id)}
				></button>
				<span class="txt type-body">{t.text}</span>
				{#if p}<Avatar profile={p} size={26} />{/if}
				{#if !family.readOnly}
					<button
						type="button"
						class="del"
						aria-label="Remove"
						onclick={() => family.removeTask(t.id)}><X size={15} /></button
					>
				{/if}
			</li>
		{/each}
		{#if open.length === 0}
			<li class="empty type-body">All done! 🎉</li>
		{/if}
	</ul>

	{#if done.length}
		<h2 class="type-heading donehead">Completed</h2>
		<ul class="list">
			{#each done as t (t.id)}
				<li class="task done">
					<button
						type="button"
						class="chk on"
						aria-label="Uncomplete"
						disabled={family.readOnly}
						onclick={() => family.toggleTask(t.id)}><Check size={14} strokeWidth={3} /></button
					>
					<span class="txt type-body">{t.text}</span>
					{#if !family.readOnly}
						<button
							type="button"
							class="del"
							aria-label="Remove"
							onclick={() => family.removeTask(t.id)}><X size={15} /></button
						>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.tasks-page {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding-top: var(--space-2);
		max-width: 640px;
	}
	.page-title {
		color: var(--color-text-primary);
	}
	.addbar {
		display: flex;
		gap: var(--space-2);
		flex-wrap: wrap;
	}
	.in {
		padding: 11px 13px;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border-subtle);
		background: var(--color-surface);
		color: var(--color-text-primary);
	}
	.addbar .in:first-child {
		flex: 1;
		min-width: 160px;
	}
	.who {
		flex: 0 0 auto;
	}
	.add {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 0 16px;
		border-radius: var(--radius-pill);
		background: var(--color-text-primary);
		color: var(--color-surface);
		font-weight: var(--weight-semibold);
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.task {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: 12px 14px;
		border-radius: var(--radius-md);
		background: var(--color-surface);
		box-shadow: var(--shadow-card);
	}
	.chk {
		width: 24px;
		height: 24px;
		flex: none;
		border-radius: var(--radius-sm);
		border: 2px solid var(--color-border-subtle);
		display: grid;
		place-items: center;
		color: white;
	}
	.chk.on {
		background: var(--color-accent-success);
		border-color: var(--color-accent-success);
	}
	.txt {
		flex: 1;
		color: var(--color-text-primary);
	}
	.task.done .txt {
		color: var(--color-text-tertiary);
		text-decoration: line-through;
	}
	.del {
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		border-radius: var(--radius-pill);
		color: var(--color-text-tertiary);
	}
	.del:hover {
		color: var(--color-accent-warning);
	}
	.donehead {
		color: var(--color-text-secondary);
		margin-top: var(--space-2);
	}
	.empty {
		color: var(--color-text-secondary);
		padding: var(--space-3);
	}
</style>
