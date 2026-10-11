<script lang="ts" generics="T extends string">
	/**
	 * Fixed bottom tab bar for a narrow phone screen, capped to a few items
	 * plus a "More" sheet — the same shape Sidebar.svelte already uses for the
	 * kiosk in portrait mount, because that is the same problem (more
	 * sections than fit in one row) with the same answer: never let a tab bar
	 * overflow a row with no visible sign there's more to it. A horizontal
	 * scrolling row with no fade or arrow reads as a cut-off label, not an
	 * invitation to scroll — which is exactly what it looked like before this
	 * existed.
	 *
	 * Generic over the tab value type so callers get a typed onselect rather
	 * than a bare string.
	 */
	import { MoreHorizontal, X } from 'lucide-svelte';
	import type { TabBarItem } from './tabBar';

	let {
		items,
		active,
		onselect
	}: {
		items: TabBarItem<T>[];
		active: T;
		onselect: (value: T) => void;
	} = $props();

	// However many fit comfortably in one row on a phone width; everything
	// else goes behind "More" rather than being scrolled off invisibly.
	const PRIMARY_COUNT = 4;
	const primary = $derived(
		items.length > PRIMARY_COUNT + 1 ? items.slice(0, PRIMARY_COUNT) : items
	);
	const overflow = $derived(items.slice(primary.length));
	const overflowActive = $derived(overflow.some((i) => i.value === active));

	let moreOpen = $state(false);

	function pick(v: T) {
		moreOpen = false;
		onselect(v);
	}
</script>

<nav class="tabbar" aria-label="Sections">
	{#each primary as item (item.value)}
		{@const Ico = item.icon}
		{#if item.href}
			<a
				class="item pressable"
				class:active={item.value === active}
				href={item.href}
				onclick={item.onclick}
			>
				<Ico size={22} strokeWidth={1.9} />
				<span class="label type-caption">{item.label}</span>
			</a>
		{:else}
			<button
				type="button"
				class="item pressable"
				class:active={item.value === active}
				onclick={() => pick(item.value)}
			>
				<Ico size={22} strokeWidth={1.9} />
				<span class="label type-caption">{item.label}</span>
			</button>
		{/if}
	{/each}
	{#if overflow.length}
		<button
			type="button"
			class="item pressable"
			class:active={overflowActive}
			onclick={() => (moreOpen = true)}
		>
			<MoreHorizontal size={22} strokeWidth={1.9} />
			<span class="label type-caption">More</span>
		</button>
	{/if}
</nav>

{#if moreOpen}
	<div
		class="scrim"
		role="button"
		tabindex="-1"
		aria-label="Close"
		onclick={() => (moreOpen = false)}
		onkeydown={(e) => e.key === 'Escape' && (moreOpen = false)}
	></div>
	<div class="sheet" role="dialog" aria-modal="true" aria-label="More">
		<header class="shead">
			<span class="type-heading">More</span>
			<button type="button" class="close" aria-label="Close" onclick={() => (moreOpen = false)}>
				<X size={20} />
			</button>
		</header>
		<ul class="sheetlist">
			{#each overflow as item (item.value)}
				{@const Ico = item.icon}
				<li>
					{#if item.href}
						<a
							class="srow pressable"
							class:active={item.value === active}
							href={item.href}
							onclick={() => {
								moreOpen = false;
								item.onclick?.();
							}}
						>
							<Ico size={20} strokeWidth={1.9} />
							<span class="type-body-lg">{item.label}</span>
						</a>
					{:else}
						<button
							type="button"
							class="srow pressable"
							class:active={item.value === active}
							onclick={() => pick(item.value)}
						>
							<Ico size={20} strokeWidth={1.9} />
							<span class="type-body-lg">{item.label}</span>
						</button>
					{/if}
				</li>
			{/each}
		</ul>
	</div>
{/if}

<style>
	.tabbar {
		position: sticky;
		bottom: 0;
		z-index: 10;
		display: flex;
		align-items: center;
		justify-content: space-around;
		gap: 2px;
		width: 100%;
		padding: var(--space-2) var(--space-2)
			max(var(--space-2), env(safe-area-inset-bottom, var(--space-2)));
		background: var(--color-surface);
		border-top: 1px solid var(--color-border-subtle);
	}
	.item {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 6px 4px;
		border-radius: var(--radius-md);
		color: var(--color-text-secondary);
		min-width: 0;
	}
	.item.active {
		color: var(--color-text-primary);
	}
	.label {
		text-align: center;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 100%;
	}

	.scrim {
		position: fixed;
		inset: 0;
		z-index: 250;
		background: rgba(20, 20, 20, 0.4);
		backdrop-filter: blur(2px);
	}
	.sheet {
		position: fixed;
		z-index: 251;
		left: 0;
		right: 0;
		bottom: 0;
		max-height: 70vh;
		padding: var(--space-4) var(--space-4)
			max(var(--space-4), env(safe-area-inset-bottom, var(--space-4)));
		border-radius: var(--radius-xl) var(--radius-xl) 0 0;
		background: var(--color-surface);
		box-shadow: var(--shadow-float);
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		overflow-y: auto;
	}
	.shead {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.shead .type-heading {
		color: var(--color-text-primary);
	}
	.close {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border-radius: var(--radius-pill);
		background: var(--color-surface-elevated);
		color: var(--color-text-secondary);
	}
	.sheetlist {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.srow {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		width: 100%;
		padding: 14px var(--space-3);
		border-radius: var(--radius-md);
		color: var(--color-text-secondary);
		text-align: left;
	}
	.srow.active {
		color: var(--color-text-primary);
		background: var(--color-surface-elevated);
		font-weight: var(--weight-semibold);
	}
</style>
