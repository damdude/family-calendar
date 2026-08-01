<script lang="ts">
	import { family } from '$lib/stores/family.svelte';
	import type { Recipe } from '$lib/types';
	import { Plus, X, Trash2, ChefHat } from 'lucide-svelte';

	const recipes = $derived(family.data.recipes);

	let viewing = $state<Recipe | null>(null);
	let editing = $state<Recipe | null>(null);
	let creating = $state(false);

	// Editor fields
	let name = $state('');
	let emoji = $state('🍽️');
	let ingredientsText = $state('');
	let stepsText = $state('');

	function openCreate() {
		creating = true;
		editing = null;
		name = '';
		emoji = '🍽️';
		ingredientsText = '';
		stepsText = '';
	}
	function openEdit(r: Recipe) {
		editing = r;
		creating = false;
		name = r.name;
		emoji = r.emoji;
		ingredientsText = r.ingredients.join('\n');
		stepsText = r.steps.join('\n');
		viewing = null;
	}
	function closeEditor() {
		creating = false;
		editing = null;
	}
	const editorOpen = $derived(creating || editing !== null);

	function save() {
		if (!name.trim()) return;
		const payload = {
			name: name.trim(),
			emoji: emoji.trim() || '🍽️',
			ingredients: ingredientsText
				.split('\n')
				.map((s) => s.trim())
				.filter(Boolean),
			steps: stepsText
				.split('\n')
				.map((s) => s.trim())
				.filter(Boolean)
		};
		if (editing) family.updateRecipe(editing.id, payload);
		else family.addRecipe(payload);
		closeEditor();
	}
	function del() {
		if (editing) family.removeRecipe(editing.id);
		closeEditor();
	}
</script>

<div class="recipes-page">
	<div class="pagehead">
		<h1 class="type-title page-title">Recipes</h1>
		{#if !family.readOnly}
			<button type="button" class="new" onclick={openCreate}><Plus size={18} /> New recipe</button>
		{/if}
	</div>

	{#if recipes.length === 0}
		<p class="type-body empty"><ChefHat size={18} /> No recipes yet.</p>
	{/if}

	<div class="grid">
		{#each recipes as r (r.id)}
			<button type="button" class="card" onclick={() => (viewing = r)}>
				<span class="emoji">{r.emoji}</span>
				<span class="name type-body-lg">{r.name}</span>
				<span class="meta type-caption"
					>{r.ingredients.length} ingredients · {r.steps.length} steps</span
				>
			</button>
		{/each}
	</div>
</div>

<!-- View modal -->
{#if viewing}
	<div
		class="scrim"
		role="button"
		tabindex="-1"
		aria-label="Close"
		onclick={() => (viewing = null)}
		onkeydown={(e) => e.key === 'Escape' && (viewing = null)}
	></div>
	<div class="modal" role="dialog" aria-modal="true">
		<header class="mhead">
			<h2 class="type-title">{viewing.emoji} {viewing.name}</h2>
			<button type="button" class="close" aria-label="Close" onclick={() => (viewing = null)}
				><X size={20} /></button
			>
		</header>
		<h3 class="type-heading">Ingredients</h3>
		<ul class="ing">
			{#each viewing.ingredients as i (i)}<li class="type-body">{i}</li>{/each}
		</ul>
		<h3 class="type-heading">Steps</h3>
		<ol class="steps">
			{#each viewing.steps as s (s)}<li class="type-body">{s}</li>{/each}
		</ol>
		{#if !family.readOnly}
			<button type="button" class="editbtn" onclick={() => viewing && openEdit(viewing)}
				>Edit</button
			>
		{/if}
	</div>
{/if}

<!-- Editor modal -->
{#if editorOpen}
	<div
		class="scrim"
		role="button"
		tabindex="-1"
		aria-label="Close"
		onclick={closeEditor}
		onkeydown={(e) => e.key === 'Escape' && closeEditor()}
	></div>
	<div class="modal" role="dialog" aria-modal="true">
		<header class="mhead">
			<h2 class="type-title">{editing ? 'Edit recipe' : 'New recipe'}</h2>
			<button type="button" class="close" aria-label="Close" onclick={closeEditor}
				><X size={20} /></button
			>
		</header>
		<div class="row">
			<input class="in emoji-in" type="text" bind:value={emoji} maxlength="4" aria-label="Emoji" />
			<input class="in" type="text" placeholder="Recipe name" bind:value={name} maxlength="120" />
		</div>
		<label class="field"
			><span class="type-label lbl">Ingredients (one per line)</span>
			<textarea class="in ta" rows="5" bind:value={ingredientsText}></textarea></label
		>
		<label class="field"
			><span class="type-label lbl">Steps (one per line)</span>
			<textarea class="in ta" rows="6" bind:value={stepsText}></textarea></label
		>
		<footer class="foot">
			{#if editing}<button type="button" class="dangerbtn" onclick={del}
					><Trash2 size={16} /> Delete</button
				>{:else}<span></span>{/if}
			<button type="button" class="savebtn" onclick={save}>Save</button>
		</footer>
	</div>
{/if}

<style>
	.recipes-page {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding-top: var(--space-2);
	}
	.pagehead {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.page-title {
		color: var(--color-text-primary);
	}
	.new,
	.editbtn,
	.savebtn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 9px 16px;
		border-radius: var(--radius-pill);
		background: var(--color-text-primary);
		color: var(--color-surface);
		font-weight: var(--weight-semibold);
	}
	.empty {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--color-text-secondary);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: var(--space-3);
	}
	.card {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 4px;
		padding: var(--space-4);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		box-shadow: var(--shadow-card);
		text-align: left;
	}
	.card .emoji {
		font-size: 2rem;
	}
	.name {
		color: var(--color-text-primary);
	}
	.meta {
		color: var(--color-text-tertiary);
	}
	.scrim {
		position: fixed;
		inset: 0;
		z-index: 150;
		background: rgba(20, 20, 20, 0.35);
		backdrop-filter: blur(2px);
	}
	.modal {
		position: fixed;
		z-index: 151;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		width: min(480px, calc(100vw - 32px));
		max-height: 88vh;
		overflow-y: auto;
		background: var(--color-surface);
		border-radius: var(--radius-xl);
		box-shadow: var(--shadow-float);
		padding: var(--space-5);
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.mhead {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.close {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border-radius: var(--radius-pill);
		color: var(--color-text-secondary);
	}
	.ing,
	.steps {
		margin: 0 0 var(--space-2);
		padding-left: 1.2em;
		display: flex;
		flex-direction: column;
		gap: 4px;
		color: var(--color-text-secondary);
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.lbl {
		color: var(--color-text-secondary);
	}
	.row {
		display: flex;
		gap: var(--space-2);
	}
	.in {
		padding: 11px 13px;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border-subtle);
		background: var(--color-surface);
		color: var(--color-text-primary);
		font-size: var(--text-base);
		flex: 1;
	}
	.emoji-in {
		flex: 0 0 56px;
		text-align: center;
	}
	.ta {
		resize: vertical;
		font-family: inherit;
	}
	.foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-top: var(--space-2);
	}
	.dangerbtn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 9px 16px;
		border-radius: var(--radius-pill);
		background: color-mix(in srgb, var(--color-accent-warning) 15%, white);
		color: var(--color-accent-warning);
		font-weight: var(--weight-semibold);
	}
</style>
