<script lang="ts">
	import { family } from '$lib/stores/family.svelte';
	import type { MealType } from '$lib/types';
	import { startOfWeek, weekColumns } from '$lib/time';
	import { Plus } from 'lucide-svelte';

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
				{@const m = mealAt(col.date, type)}
				<div class="cell" class:today={col.isToday}>
					{#if m}
						<span class="emoji">{m.emoji}</span>
						<span class="name type-caption">{m.name}</span>
					{:else}
						<button class="add pressable" type="button" aria-label="Add {typeLabel[type]}">
							<Plus size={18} />
						</button>
					{/if}
				</div>
			{/each}
		{/each}
	</div>
</div>

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
</style>
