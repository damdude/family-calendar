<script lang="ts">
	import { family } from '$lib/stores/family.svelte';
	import type { Recipe, MealType } from '$lib/types';
	import { RECIPE_CATALOG, RECIPE_CATEGORIES, type CatalogRecipe } from '$lib/recipeCatalog';
	import { page } from '$app/state';
	import { Plus, X, Trash2, ChefHat, Link2, CalendarPlus, ExternalLink } from 'lucide-svelte';

	type Scraped = {
		name: string;
		image?: string;
		ingredients: string[];
		steps: string[];
		sourceUrl: string;
	};

	const savedRecipes = $derived(family.data.recipes);

	let tab = $state<'browse' | 'mine'>('browse');
	let activeCat = $state<string>(RECIPE_CATEGORIES[0]);
	const catalogInCat = $derived(RECIPE_CATALOG.filter((r) => r.category === activeCat));

	// --- Detail viewer (catalog OR saved) ---
	let viewCatalog = $state<CatalogRecipe | null>(null);
	let viewSaved = $state<Recipe | null>(null);
	let fetched = $state<Scraped | null>(null);
	let loading = $state(false);
	let fetchErr = $state('');
	let savedFromView = $state<Recipe | null>(null);

	const viewOpen = $derived(viewCatalog !== null || viewSaved !== null);

	function openCatalog(r: CatalogRecipe) {
		viewCatalog = r;
		viewSaved = null;
		fetched = null;
		fetchErr = '';
		savedFromView = family.recipeByUrl(r.sourceUrl) ?? null;
		if (savedFromView) {
			fetched = {
				name: savedFromView.name,
				image: savedFromView.image,
				ingredients: savedFromView.ingredients,
				steps: savedFromView.steps,
				sourceUrl: r.sourceUrl
			};
		}
	}
	function openSaved(r: Recipe) {
		viewSaved = r;
		viewCatalog = null;
		fetched = {
			name: r.name,
			image: r.image,
			ingredients: r.ingredients,
			steps: r.steps,
			sourceUrl: r.sourceUrl ?? ''
		};
		savedFromView = r;
		fetchErr = '';
	}
	function closeView() {
		viewCatalog = null;
		viewSaved = null;
		fetched = null;
		savedFromView = null;
	}

	async function getFullRecipe() {
		if (!viewCatalog) return;
		loading = true;
		fetchErr = '';
		try {
			const res = await fetch('/api/recipes/import', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ url: viewCatalog.sourceUrl })
			});
			if (!res.ok) throw new Error();
			fetched = await res.json();
		} catch {
			fetchErr =
				"Couldn't fetch the full recipe (offline or the site blocked it). The link still works below.";
		} finally {
			loading = false;
		}
	}

	function saveCurrent(): Recipe | null {
		if (savedFromView) return savedFromView;
		if (!fetched && !viewCatalog) return null;
		const base = viewCatalog;
		const rec = family.addRecipe({
			// Prefer the catalog's clean name over the page's SEO-y JSON-LD title.
			name: base?.name || fetched?.name || 'Recipe',
			emoji: base?.emoji || '🍽️',
			ingredients: fetched?.ingredients ?? [],
			steps: fetched?.steps ?? [],
			sourceUrl: base?.sourceUrl ?? fetched?.sourceUrl,
			image: fetched?.image,
			cuisine: base?.cuisine,
			category: base?.category
		});
		savedFromView = rec;
		return rec;
	}

	// --- Plan to a day ---
	let planOpen = $state(false);
	let planDate = $state(todayKey());
	let planType = $state<MealType>('dinner');
	let planned = $state('');
	function todayKey() {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}
	function doPlan() {
		const rec = viewSaved ?? saveCurrent();
		if (!rec) return;
		family.planRecipe(planDate, planType, rec);
		planned = `Planned for ${planType} on ${planDate}`;
		planOpen = false;
		setTimeout(() => (planned = ''), 2600);
	}

	// --- Import by URL ---
	let importUrl = $state('');
	let importing = $state(false);
	let importErr = $state('');
	async function importByUrl() {
		if (!importUrl.trim()) return;
		importing = true;
		importErr = '';
		try {
			const res = await fetch('/api/recipes/import', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ url: importUrl.trim() })
			});
			if (!res.ok) throw new Error();
			const r: Scraped = await res.json();
			const rec = family.addRecipe({
				name: r.name,
				emoji: '🍽️',
				ingredients: r.ingredients,
				steps: r.steps,
				sourceUrl: r.sourceUrl,
				image: r.image
			});
			importUrl = '';
			tab = 'mine';
			openSaved(rec);
		} catch {
			importErr = "Couldn't read a recipe from that link.";
		} finally {
			importing = false;
		}
	}

	// --- Manual create/edit ---
	let editing = $state<Recipe | null>(null);
	let creating = $state(false);
	let mName = $state('');
	let mEmoji = $state('🍽️');
	let mIng = $state('');
	let mSteps = $state('');
	const editorOpen = $derived(creating || editing !== null);
	function openCreate() {
		creating = true;
		editing = null;
		mName = '';
		mEmoji = '🍽️';
		mIng = '';
		mSteps = '';
	}
	function openEdit(r: Recipe) {
		editing = r;
		creating = false;
		mName = r.name;
		mEmoji = r.emoji;
		mIng = r.ingredients.join('\n');
		mSteps = r.steps.join('\n');
		closeView();
	}
	function saveManual() {
		if (!mName.trim()) return;
		const payload = {
			name: mName.trim(),
			emoji: mEmoji.trim() || '🍽️',
			ingredients: mIng
				.split('\n')
				.map((s) => s.trim())
				.filter(Boolean),
			steps: mSteps
				.split('\n')
				.map((s) => s.trim())
				.filter(Boolean)
		};
		if (editing) family.updateRecipe(editing.id, { ...editing, ...payload });
		else family.addRecipe(payload);
		creating = false;
		editing = null;
	}
	function delManual() {
		if (editing) family.removeRecipe(editing.id);
		creating = false;
		editing = null;
	}

	// Deep-link: /recipes?recipe=<id> (from a planned meal day).
	$effect(() => {
		const id = Number(page.url.searchParams.get('recipe'));
		if (id) {
			const r = family.data.recipes.find((x) => x.id === id);
			if (r) {
				tab = 'mine';
				openSaved(r);
			}
		}
	});
</script>

<div class="recipes-page">
	<div class="pagehead">
		<h1 class="type-title page-title">Recipes</h1>
		<div class="tabs">
			<button type="button" class="tab" class:on={tab === 'browse'} onclick={() => (tab = 'browse')}
				>Browse</button
			>
			<button type="button" class="tab" class:on={tab === 'mine'} onclick={() => (tab = 'mine')}
				>My recipes {#if savedRecipes.length}<span class="badge">{savedRecipes.length}</span
					>{/if}</button
			>
		</div>
	</div>

	{#if tab === 'browse'}
		<div class="cats">
			{#each RECIPE_CATEGORIES as c (c)}
				<button type="button" class="cat" class:on={activeCat === c} onclick={() => (activeCat = c)}
					>{c}</button
				>
			{/each}
		</div>
		<div class="grid">
			{#each catalogInCat as r (r.sourceUrl)}
				<button type="button" class="card" onclick={() => openCatalog(r)}>
					<span class="emoji">{r.emoji}</span>
					<span class="name type-body-lg">{r.name}</span>
					<span class="cuisine type-caption">{r.cuisine}</span>
					<span class="blurb type-caption">{r.blurb}</span>
				</button>
			{/each}
		</div>
	{:else}
		<div class="importbar">
			<Link2 size={18} />
			<input
				class="in"
				type="url"
				placeholder="Paste a recipe link to import…"
				bind:value={importUrl}
				onkeydown={(e) => e.key === 'Enter' && importByUrl()}
			/>
			<button type="button" class="importbtn" disabled={importing} onclick={importByUrl}
				>{importing ? 'Reading…' : 'Import'}</button
			>
			{#if !family.readOnly}
				<button type="button" class="new" onclick={openCreate}><Plus size={16} /> New</button>
			{/if}
		</div>
		{#if importErr}<p class="err type-caption">{importErr}</p>{/if}

		{#if savedRecipes.length === 0}
			<p class="type-body empty">
				<ChefHat size={18} /> No saved recipes yet — browse or import one.
			</p>
		{/if}
		<div class="grid">
			{#each savedRecipes as r (r.id)}
				<button type="button" class="card" onclick={() => openSaved(r)}>
					<span class="emoji">{r.emoji}</span>
					<span class="name type-body-lg">{r.name}</span>
					<span class="meta type-caption"
						>{r.ingredients.length} ingredients · {r.steps.length} steps</span
					>
				</button>
			{/each}
		</div>
	{/if}
</div>

<!-- Detail viewer -->
{#if viewOpen}
	{@const cat = viewCatalog}
	{@const srcHref = cat?.sourceUrl || viewSaved?.sourceUrl}
	<div
		class="scrim"
		role="button"
		tabindex="-1"
		aria-label="Close"
		onclick={closeView}
		onkeydown={(e) => e.key === 'Escape' && closeView()}
	></div>
	<div class="modal" role="dialog" aria-modal="true">
		<header class="mhead">
			<h2 class="type-title">{(fetched?.name ?? cat?.name) || viewSaved?.name}</h2>
			<button type="button" class="close" aria-label="Close" onclick={closeView}
				><X size={20} /></button
			>
		</header>

		{#if fetched?.image}
			<img class="hero" src={fetched.image} alt="" referrerpolicy="no-referrer" />
		{/if}
		{#if cat}<p class="type-body sub">{cat.blurb}</p>{/if}

		{#if loading}
			<p class="type-body sub">Fetching the full recipe…</p>
		{:else if fetched && (fetched.ingredients.length || fetched.steps.length)}
			{#if fetched.ingredients.length}
				<h3 class="type-heading">Ingredients</h3>
				<ul class="ing">
					{#each fetched.ingredients as i, idx (idx)}<li class="type-body">{i}</li>{/each}
				</ul>
			{/if}
			{#if fetched.steps.length}
				<h3 class="type-heading">Steps</h3>
				<ol class="steps">
					{#each fetched.steps as s, idx (idx)}<li class="type-body">{s}</li>{/each}
				</ol>
			{/if}
		{:else if cat}
			<button type="button" class="primary" onclick={getFullRecipe}>Get full recipe</button>
		{/if}
		{#if fetchErr}<p class="err type-caption">{fetchErr}</p>{/if}

		{#if planOpen}
			<div class="planbox">
				<div class="planrow">
					<input class="in" type="date" bind:value={planDate} />
					<select class="in" bind:value={planType}>
						<option value="breakfast">Breakfast</option>
						<option value="lunch">Lunch</option>
						<option value="dinner">Dinner</option>
						<option value="snack">Snack</option>
					</select>
				</div>
				<button type="button" class="primary" onclick={doPlan}>Add to plan</button>
			</div>
		{/if}

		<footer class="vfoot">
			{#if srcHref}
				<a class="srclink" href={srcHref} target="_blank" rel="noreferrer"
					><ExternalLink size={15} /> Source</a
				>
			{/if}
			<div class="spacer"></div>
			{#if viewSaved && !family.readOnly}
				<button type="button" class="ghost" onclick={() => viewSaved && openEdit(viewSaved)}
					>Edit</button
				>
			{:else if cat && !savedFromView && !family.readOnly}
				<button type="button" class="ghost" onclick={saveCurrent}>Save</button>
			{/if}
			{#if !family.readOnly}
				<button type="button" class="primary" onclick={() => (planOpen = !planOpen)}
					><CalendarPlus size={16} /> Plan a day</button
				>
			{/if}
		</footer>
	</div>
{/if}

<!-- Manual editor -->
{#if editorOpen}
	<div
		class="scrim"
		role="button"
		tabindex="-1"
		aria-label="Close"
		onclick={() => {
			creating = false;
			editing = null;
		}}
		onkeydown={(e) => e.key === 'Escape' && (creating = false)}
	></div>
	<div class="modal" role="dialog" aria-modal="true">
		<header class="mhead">
			<h2 class="type-title">{editing ? 'Edit recipe' : 'New recipe'}</h2>
			<button
				type="button"
				class="close"
				aria-label="Close"
				onclick={() => {
					creating = false;
					editing = null;
				}}><X size={20} /></button
			>
		</header>
		<div class="row">
			<input class="in emoji-in" type="text" bind:value={mEmoji} maxlength="4" aria-label="Emoji" />
			<input class="in" type="text" placeholder="Recipe name" bind:value={mName} maxlength="120" />
		</div>
		<label class="field"
			><span class="type-label lbl">Ingredients (one per line)</span>
			<textarea class="in ta" rows="5" bind:value={mIng}></textarea></label
		>
		<label class="field"
			><span class="type-label lbl">Steps (one per line)</span>
			<textarea class="in ta" rows="6" bind:value={mSteps}></textarea></label
		>
		<footer class="vfoot">
			{#if editing}<button type="button" class="danger" onclick={delManual}
					><Trash2 size={16} /> Delete</button
				>{/if}
			<div class="spacer"></div>
			<button type="button" class="primary" onclick={saveManual}>Save</button>
		</footer>
	</div>
{/if}

{#if planned}<div class="toast" role="status">📅 {planned}</div>{/if}

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
		flex-wrap: wrap;
		gap: var(--space-3);
	}
	.page-title {
		color: var(--color-text-primary);
	}
	.tabs {
		display: flex;
		gap: 4px;
		padding: 3px;
		background: var(--color-surface-elevated);
		border-radius: var(--radius-pill);
	}
	.tab {
		padding: 7px 16px;
		border-radius: var(--radius-pill);
		color: var(--color-text-secondary);
		font-weight: var(--weight-medium);
		display: inline-flex;
		gap: 6px;
		align-items: center;
	}
	.tab.on {
		background: var(--color-surface);
		color: var(--color-text-primary);
		box-shadow: var(--shadow-card);
	}
	.badge {
		background: var(--color-text-primary);
		color: var(--color-surface);
		border-radius: var(--radius-pill);
		font-size: var(--text-xs);
		padding: 0 7px;
		line-height: 1.5;
	}
	.cats {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	.cat {
		padding: 8px 14px;
		border-radius: var(--radius-pill);
		background: var(--color-surface-elevated);
		color: var(--color-text-secondary);
		font-weight: var(--weight-medium);
		font-size: var(--text-sm);
	}
	.cat.on {
		background: var(--color-text-primary);
		color: var(--color-surface);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
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
	.card:hover {
		box-shadow: var(--shadow-float);
	}
	.card .emoji {
		font-size: 2rem;
	}
	.name {
		color: var(--color-text-primary);
	}
	.cuisine {
		color: var(--color-accent-warning);
		font-weight: var(--weight-semibold);
	}
	.blurb,
	.meta {
		color: var(--color-text-tertiary);
	}
	.importbar {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex-wrap: wrap;
	}
	.importbar :global(svg) {
		color: var(--color-text-tertiary);
		flex: none;
	}
	.in {
		padding: 10px 12px;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border-subtle);
		background: var(--color-surface);
		color: var(--color-text-primary);
		font-size: var(--text-base);
	}
	.importbar .in {
		flex: 1;
		min-width: 180px;
	}
	.importbtn,
	.new {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 10px 16px;
		border-radius: var(--radius-pill);
		background: var(--color-text-primary);
		color: var(--color-surface);
		font-weight: var(--weight-semibold);
	}
	.importbtn:disabled {
		opacity: 0.5;
	}
	.new {
		background: var(--color-surface-elevated);
		color: var(--color-text-primary);
	}
	.empty {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--color-text-secondary);
	}
	.err {
		color: var(--color-accent-warning);
	}
	.scrim {
		position: fixed;
		inset: 0;
		z-index: 150;
		background: rgba(20, 20, 20, 0.4);
		backdrop-filter: blur(2px);
	}
	.modal {
		position: fixed;
		z-index: 151;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		width: min(560px, calc(100vw - 24px));
		max-height: 90vh;
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
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-3);
	}
	.mhead h2 {
		color: var(--color-text-primary);
	}
	.close {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		flex: none;
		border-radius: var(--radius-pill);
		color: var(--color-text-secondary);
	}
	.hero {
		width: 100%;
		max-height: 220px;
		object-fit: cover;
		border-radius: var(--radius-md);
	}
	.sub {
		color: var(--color-text-secondary);
	}
	.ing,
	.steps {
		margin: 0 0 var(--space-2);
		padding-left: 1.2em;
		display: flex;
		flex-direction: column;
		gap: 5px;
		color: var(--color-text-secondary);
	}
	.planbox {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-3);
		border-radius: var(--radius-md);
		background: var(--color-surface-elevated);
	}
	.planrow {
		display: flex;
		gap: var(--space-2);
	}
	.planrow .in {
		flex: 1;
	}
	.vfoot {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-top: var(--space-2);
	}
	.spacer {
		flex: 1;
	}
	.srclink {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		color: var(--color-text-secondary);
		font-size: var(--text-sm);
		text-decoration: none;
	}
	.primary {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 9px 16px;
		border-radius: var(--radius-pill);
		background: var(--color-text-primary);
		color: var(--color-surface);
		font-weight: var(--weight-semibold);
	}
	.ghost {
		padding: 9px 16px;
		border-radius: var(--radius-pill);
		background: var(--color-surface-elevated);
		color: var(--color-text-primary);
		font-weight: var(--weight-semibold);
	}
	.danger {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 9px 16px;
		border-radius: var(--radius-pill);
		background: color-mix(in srgb, var(--color-accent-warning) 15%, var(--color-surface));
		color: var(--color-accent-warning);
		font-weight: var(--weight-semibold);
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
	.row .in {
		flex: 1;
	}
	.emoji-in {
		flex: 0 0 56px;
		text-align: center;
	}
	.ta {
		resize: vertical;
		font-family: inherit;
		width: 100%;
	}
	.toast {
		position: fixed;
		left: 50%;
		bottom: calc(var(--space-6) + var(--bottom-nav-clearance, 0px));
		transform: translateX(-50%);
		z-index: 200;
		padding: 12px 20px;
		border-radius: var(--radius-pill);
		background: var(--color-text-primary);
		color: var(--color-surface);
		font-weight: var(--weight-semibold);
		box-shadow: var(--shadow-float);
	}
</style>
