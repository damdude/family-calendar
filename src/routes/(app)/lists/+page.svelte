<script lang="ts">
	import { family } from '$lib/stores/family.svelte';
	import { Check, Plus, X } from 'lucide-svelte';

	const lists = $derived(family.data.lists);
	let drafts = $state<Record<number, string>>({});
	let newListName = $state('');

	function remaining(listId: number): number {
		const l = lists.find((x) => x.id === listId);
		return l ? l.items.filter((i) => !i.completed).length : 0;
	}

	function toggle(listId: number, itemId: number) {
		if (family.readOnly) return;
		family.toggleListItem(listId, itemId);
		family.persistFamilyData();
	}
	function addItem(listId: number) {
		const text = drafts[listId] ?? '';
		if (!text.trim()) return;
		family.addListItem(listId, text);
		drafts[listId] = '';
		family.persistFamilyData();
	}
	function removeItem(listId: number, itemId: number) {
		family.removeListItem(listId, itemId);
		family.persistFamilyData();
	}
	function addList() {
		if (!newListName.trim()) return;
		family.addList(newListName);
		newListName = '';
		family.persistFamilyData();
	}
</script>

<div class="lists-page">
	<h1 class="type-title page-title">Lists</h1>

	<div class="board">
		{#each lists as list (list.id)}
			<section class="list-card">
				<header class="lhead">
					<span class="licon">{list.icon}</span>
					<div class="lmeta">
						<h2 class="type-heading">{list.name}</h2>
						<span class="type-caption count">{remaining(list.id)} left</span>
					</div>
				</header>

				<ul class="items">
					{#each list.items as item (item.id)}
						<li class="itemrow">
							<button
								type="button"
								class="item pressable"
								class:done={item.completed}
								onclick={() => toggle(list.id, item.id)}
								aria-pressed={item.completed}
							>
								<span class="box">
									{#if item.completed}<Check size={15} strokeWidth={3} />{/if}
								</span>
								<span class="text type-body">{item.text}</span>
							</button>
							{#if !family.readOnly}
								<button
									type="button"
									class="del"
									aria-label="Remove {item.text}"
									onclick={() => removeItem(list.id, item.id)}><X size={14} /></button
								>
							{/if}
						</li>
					{/each}
				</ul>

				{#if !family.readOnly}
					<div class="additem">
						<input
							class="addinput"
							type="text"
							placeholder="Add item…"
							bind:value={drafts[list.id]}
							onkeydown={(e) => e.key === 'Enter' && addItem(list.id)}
						/>
						<button
							type="button"
							class="addbtn"
							aria-label="Add item"
							onclick={() => addItem(list.id)}
						>
							<Plus size={16} />
						</button>
					</div>
				{/if}
			</section>
		{/each}

		{#if !family.readOnly}
			<section class="list-card newlist">
				<input
					class="addinput"
					type="text"
					placeholder="New list name…"
					bind:value={newListName}
					onkeydown={(e) => e.key === 'Enter' && addList()}
				/>
				<button type="button" class="addbtn wide" onclick={addList}
					><Plus size={16} /> New list</button
				>
			</section>
		{/if}
	</div>
</div>

<style>
	.lists-page {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding-top: var(--space-2);
	}
	.page-title {
		color: var(--color-text-primary);
	}
	.board {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: var(--space-4);
		align-items: start;
	}
	.list-card {
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-card);
		padding: var(--space-4);
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.lhead {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.licon {
		font-size: 1.6rem;
	}
	.lmeta {
		display: flex;
		flex-direction: column;
	}
	.count {
		color: var(--color-text-tertiary);
	}
	.items {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.item {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		width: 100%;
		padding: 10px 8px;
		border-radius: var(--radius-md);
		text-align: left;
	}
	.item:hover {
		background: var(--color-surface-elevated);
	}
	.box {
		display: grid;
		place-items: center;
		width: 24px;
		height: 24px;
		flex: none;
		border-radius: var(--radius-sm);
		border: 2px solid var(--color-border-subtle);
		color: white;
		transition: all var(--dur-quick) var(--ease-out);
	}
	.item.done .box {
		background: var(--color-accent-success);
		border-color: var(--color-accent-success);
	}
	.text {
		color: var(--color-text-primary);
	}
	.item.done .text {
		color: var(--color-text-tertiary);
		text-decoration: line-through;
	}
	.itemrow {
		display: flex;
		align-items: center;
		gap: 2px;
	}
	.itemrow .item {
		flex: 1;
	}
	.del {
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		flex: none;
		border-radius: var(--radius-pill);
		color: var(--color-text-tertiary);
		opacity: 0;
		transition: opacity var(--dur-quick) var(--ease-out);
	}
	.itemrow:hover .del {
		opacity: 1;
	}
	.del:hover {
		background: var(--color-surface-elevated);
		color: var(--color-accent-warning);
	}
	.additem {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.addinput {
		flex: 1;
		min-width: 0;
		padding: 8px 12px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-border-subtle);
		background: var(--color-surface);
		color: var(--color-text-primary);
		font-size: var(--text-base);
	}
	.addbtn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		flex: none;
		width: 36px;
		height: 36px;
		border-radius: var(--radius-pill);
		background: var(--color-surface-elevated);
		color: var(--color-text-primary);
	}
	.addbtn.wide {
		width: auto;
		padding: 0 14px;
		font-weight: var(--weight-semibold);
	}
	.newlist {
		justify-content: center;
		gap: var(--space-2);
		border: 1.5px dashed var(--color-border-subtle);
		box-shadow: none;
		background: transparent;
	}
</style>
