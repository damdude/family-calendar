<script lang="ts">
	import { family } from '$lib/stores/family.svelte';
	import { Check, Plus } from 'lucide-svelte';

	const lists = $derived(family.data.lists);

	function remaining(listId: number): number {
		const l = lists.find((x) => x.id === listId);
		return l ? l.items.filter((i) => !i.completed).length : 0;
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
						<li>
							<button
								type="button"
								class="item pressable"
								class:done={item.completed}
								onclick={() => family.toggleListItem(list.id, item.id)}
								aria-pressed={item.completed}
							>
								<span class="box">
									{#if item.completed}<Check size={15} strokeWidth={3} />{/if}
								</span>
								<span class="text type-body">{item.text}</span>
							</button>
						</li>
					{/each}
				</ul>

				<button class="additem pressable type-label" type="button">
					<Plus size={16} /> Add item
				</button>
			</section>
		{/each}
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
	.additem {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		align-self: flex-start;
		padding: 8px 12px;
		border-radius: var(--radius-pill);
		color: var(--color-text-secondary);
		background: var(--color-surface-elevated);
	}
</style>
