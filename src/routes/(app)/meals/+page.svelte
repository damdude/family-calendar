<script lang="ts">
	import { family } from '$lib/stores/family.svelte';
	import type { MealType } from '$lib/types';
	import { startOfWeek, weekColumns } from '$lib/time';
	import { autoEmojiFor, CUISINES, FOOD_EMOJIS, type Dish } from '$lib/meals';
	import { Plus, X, Trash2 } from 'lucide-svelte';

	const weekStart = $derived(startOfWeek(new Date(), family.config.view.weekStartsOn));
	const columns = $derived(weekColumns(weekStart, 7));
	const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner'];
	const typeLabel: Record<MealType, string> = {
		breakfast: 'Breakfast',
		lunch: 'Lunch',
		dinner: 'Dinner',
		snack: 'Snack'
	};

	function ymd(d: Date): string {
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
			d.getDate()
		).padStart(2, '0')}`;
	}
	function mealAt(date: Date, type: MealType) {
		const key = ymd(date);
		return family.data.meals.find((m) => m.date === key && m.mealType === type);
	}
	function dayLabel(dateKey: string): string {
		const [y, m, d] = dateKey.split('-').map(Number);
		return new Date(y, m - 1, d).toLocaleDateString(undefined, {
			weekday: 'long',
			month: 'short',
			day: 'numeric'
		});
	}

	// --- Modal editor ---
	let editing = $state<{ date: string; type: MealType; existing: boolean } | null>(null);
	let draftName = $state('');
	let draftEmoji = $state('🍽️');
	let emojiTouched = $state(false);
	let activeCuisine = $state(CUISINES[0].id);

	const cuisine = $derived(CUISINES.find((c) => c.id === activeCuisine) ?? CUISINES[0]);

	function openEditor(date: string, type: MealType) {
		if (family.readOnly) return;
		const m = family.data.meals.find((x) => x.date === date && x.mealType === type && x.name);
		editing = { date, type, existing: !!m };
		draftName = m?.name ?? '';
		draftEmoji = m?.emoji ?? '🍽️';
		emojiTouched = !!m;
		activeCuisine = CUISINES[0].id;
	}
	function onNameInput() {
		// Auto-suggest an emoji from the name until the user picks one manually.
		if (!emojiTouched) draftEmoji = autoEmojiFor(draftName);
	}
	function pickEmoji(e: string) {
		draftEmoji = e;
		emojiTouched = true;
	}
	function pickDish(d: Dish) {
		draftName = d.name;
		draftEmoji = d.emoji;
		emojiTouched = true;
	}
	function save() {
		if (!editing || !draftName.trim()) return;
		family.setMeal(editing.date, editing.type, draftName.trim(), draftEmoji);
		family.persistFamilyData();
		editing = null;
	}
	function clearMeal() {
		if (!editing) return;
		family.setMeal(editing.date, editing.type, '', '');
		family.persistFamilyData();
		editing = null;
	}
</script>

<div class="meals-page">
	<h1 class="type-title page-title">Meal Plan</h1>

	<div class="grid" style:--cols={columns.length}>
		<div class="corner"></div>
		{#each columns as col (col.date.getTime())}
			<div class="dayhead" class:today={col.isToday}>
				<span class="dow type-caption">{col.label}</span>
				<span class="dnum type-body-lg">{col.dayNum}</span>
			</div>
		{/each}

		{#each mealTypes as type (type)}
			<div class="typelabel type-label">{typeLabel[type]}</div>
			{#each columns as col (col.date.getTime())}
				{@const key = ymd(col.date)}
				{@const m = mealAt(col.date, type)}
				<div class="cell" class:today={col.isToday}>
					{#if m}
						<button class="filled" type="button" onclick={() => openEditor(key, type)}>
							<span class="emoji">{m.emoji}</span>
							<span class="name type-caption">{m.name}</span>
						</button>
					{:else if !family.readOnly}
						<button
							class="add pressable"
							type="button"
							aria-label="Add {typeLabel[type]}"
							onclick={() => openEditor(key, type)}
						>
							<Plus size={18} />
						</button>
					{/if}
				</div>
			{/each}
		{/each}
	</div>
</div>

{#if editing}
	{@const ed = editing}
	<div
		class="scrim"
		role="button"
		tabindex="-1"
		aria-label="Close"
		onclick={() => (editing = null)}
		onkeydown={(e) => e.key === 'Escape' && (editing = null)}
	></div>
	<div class="modal" role="dialog" aria-modal="true">
		<header class="mhead">
			<div>
				<h2 class="type-heading">{typeLabel[ed.type]}</h2>
				<span class="type-caption sub">{dayLabel(ed.date)}</span>
			</div>
			<button type="button" class="close" aria-label="Close" onclick={() => (editing = null)}>
				<X size={20} />
			</button>
		</header>

		<div class="nameRow">
			<span class="bigemoji">{draftEmoji}</span>
			<!-- svelte-ignore a11y_autofocus -->
			<input
				class="nameinput"
				type="text"
				placeholder="What's cooking?"
				bind:value={draftName}
				oninput={onNameInput}
				autofocus
				onkeydown={(e) => e.key === 'Enter' && save()}
			/>
		</div>

		<div class="cuisines">
			{#each CUISINES as c (c.id)}
				<button
					type="button"
					class="ctab"
					class:on={activeCuisine === c.id}
					onclick={() => (activeCuisine = c.id)}>{c.emoji} {c.label}</button
				>
			{/each}
		</div>

		<div class="dishes">
			{#each cuisine.dishes as d (d.name)}
				<button type="button" class="dish" onclick={() => pickDish(d)}>
					<span class="demoji">{d.emoji}</span>
					<span class="dname type-caption">{d.name}</span>
				</button>
			{/each}
		</div>

		<details class="emojiwrap">
			<summary class="type-caption">Pick a different icon</summary>
			<div class="emojigrid">
				{#each FOOD_EMOJIS as e, i (i)}
					<button
						type="button"
						class="epick"
						class:on={draftEmoji === e}
						onclick={() => pickEmoji(e)}>{e}</button
					>
				{/each}
			</div>
		</details>

		<footer class="foot">
			{#if ed.existing}
				<button type="button" class="del" onclick={clearMeal}><Trash2 size={16} /> Remove</button>
			{:else}
				<span></span>
			{/if}
			<button type="button" class="savebtn" disabled={!draftName.trim()} onclick={save}>Save</button
			>
		</footer>
	</div>
{/if}

<style>
	.meals-page {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding-top: var(--space-2);
	}
	.page-title {
		color: var(--color-text-primary);
	}
	.grid {
		display: grid;
		grid-template-columns: 96px repeat(var(--cols), 1fr);
		gap: 8px;
	}
	.corner {
		grid-column: 1;
	}
	.dayhead {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		padding-bottom: 4px;
	}
	.dow {
		color: var(--color-text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.dnum {
		color: var(--color-text-primary);
	}
	.dayhead.today .dnum {
		width: 1.7em;
		height: 1.7em;
		display: grid;
		place-items: center;
		border-radius: var(--radius-pill);
		background: var(--color-text-primary);
		color: var(--color-surface);
	}
	.typelabel {
		display: flex;
		align-items: center;
		color: var(--color-text-secondary);
	}
	.cell {
		position: relative;
		min-height: 84px;
		border-radius: var(--radius-md);
		background: var(--color-surface);
		box-shadow: var(--shadow-card);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		padding: var(--space-2);
		text-align: center;
	}
	.filled {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		width: 100%;
		height: 100%;
		justify-content: center;
	}
	.cell.today {
		box-shadow:
			var(--shadow-card),
			0 0 0 2px color-mix(in srgb, var(--color-accent-gold) 55%, transparent);
	}
	.emoji {
		font-size: 1.9rem;
		line-height: 1;
	}
	.name {
		color: var(--color-text-secondary);
	}
	.add {
		display: grid;
		place-items: center;
		width: 38px;
		height: 38px;
		border-radius: var(--radius-pill);
		background: var(--color-surface-elevated);
		color: var(--color-text-tertiary);
	}

	/* --- Modal editor --- */
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
		width: min(520px, calc(100vw - 24px));
		max-height: 90vh;
		overflow-y: auto;
		background: var(--color-surface);
		border-radius: var(--radius-xl);
		box-shadow: var(--shadow-float);
		padding: var(--space-5);
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	.mhead {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
	}
	.mhead h2 {
		color: var(--color-text-primary);
	}
	.sub {
		color: var(--color-text-secondary);
	}
	.close {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border-radius: var(--radius-pill);
		color: var(--color-text-secondary);
	}
	.nameRow {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.bigemoji {
		font-size: 2.4rem;
		line-height: 1;
		width: 3rem;
		text-align: center;
		flex: none;
	}
	.nameinput {
		flex: 1;
		padding: 12px 14px;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border-subtle);
		background: var(--color-surface);
		color: var(--color-text-primary);
		font-size: var(--text-lg);
	}
	.cuisines {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}
	.ctab {
		padding: 7px 12px;
		border-radius: var(--radius-pill);
		background: var(--color-surface-elevated);
		color: var(--color-text-secondary);
		font-size: var(--text-sm);
		font-weight: var(--weight-medium);
	}
	.ctab.on {
		background: var(--color-text-primary);
		color: var(--color-surface);
	}
	.dishes {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 8px;
	}
	.dish {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 12px;
		border-radius: var(--radius-md);
		background: var(--color-surface-elevated);
		text-align: left;
	}
	.dish:hover {
		background: color-mix(in srgb, var(--color-accent-gold) 22%, var(--color-surface-elevated));
	}
	.demoji {
		font-size: 1.4rem;
		flex: none;
	}
	.dname {
		color: var(--color-text-primary);
	}
	.emojiwrap summary {
		cursor: pointer;
		color: var(--color-text-secondary);
		padding: 4px 0;
	}
	.emojigrid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
		gap: 4px;
		margin-top: var(--space-2);
	}
	.epick {
		font-size: 1.4rem;
		padding: 6px;
		border-radius: var(--radius-sm);
	}
	.epick.on {
		background: color-mix(in srgb, var(--color-profile-blue) 30%, var(--color-surface));
	}
	.epick:hover {
		background: var(--color-surface-elevated);
	}
	.foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.del {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 9px 16px;
		border-radius: var(--radius-pill);
		background: color-mix(in srgb, var(--color-accent-warning) 15%, var(--color-surface));
		color: var(--color-accent-warning);
		font-weight: var(--weight-semibold);
	}
	.savebtn {
		padding: 10px 22px;
		border-radius: var(--radius-pill);
		background: var(--color-text-primary);
		color: var(--color-surface);
		font-weight: var(--weight-semibold);
	}
	.savebtn:disabled {
		opacity: 0.4;
	}
</style>
