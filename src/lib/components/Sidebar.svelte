<script lang="ts">
	import { page } from '$app/state';
	import { family } from '$lib/stores/family.svelte';
	import type { FeatureFlags } from '$lib/config';
	import {
		Calendar,
		ClipboardList,
		SquareCheckBig,
		Star,
		Utensils,
		ChefHat,
		Image,
		Moon,
		ListChecks,
		LayoutGrid,
		Settings,
		MoreHorizontal,
		X,
		type Icon as IconType
	} from 'lucide-svelte';

	type NavItem = {
		label: string;
		href: string;
		icon: typeof IconType;
		/** Config flag that gates visibility (Settings is always shown). */
		feature?: keyof FeatureFlags;
		/** Built in a later batch — shown but inert. */
		soon?: boolean;
		/** Extra path prefixes that keep this item highlighted. */
		match?: string[];
	};

	const items: NavItem[] = [
		{
			label: 'Calendar',
			href: '/',
			icon: Calendar,
			feature: 'calendar',
			match: ['/profile']
		},
		{ label: 'Lists', href: '/lists', icon: ClipboardList, feature: 'lists' },
		{ label: 'Tasks', href: '/tasks', icon: SquareCheckBig, feature: 'tasks' },
		{
			label: 'Routines',
			href: '/routines',
			icon: ListChecks,
			feature: 'routines',
			match: ['/routine']
		},
		{ label: 'Rewards', href: '/rewards', icon: Star, feature: 'rewards' },
		{ label: 'Meals', href: '/meals', icon: Utensils, feature: 'meals' },
		{ label: 'Recipes', href: '/recipes', icon: ChefHat, feature: 'recipes' },
		{ label: 'Photos', href: '/photos', icon: Image, feature: 'photos' },
		{ label: 'Sleep', href: '/sleep', icon: Moon, feature: 'sleep' },
		{ label: 'Board', href: '/vestaboard', icon: LayoutGrid },
		{ label: 'Settings', href: '/settings', icon: Settings }
	];

	// Only render items whose feature flag is on (Settings has no flag).
	const visible = $derived(items.filter((i) => !i.feature || family.config.features[i.feature]));

	function isActive(item: NavItem): boolean {
		const path = page.url.pathname;
		if (item.href === '/')
			return path === '/' || (item.match ?? []).some((m) => path.startsWith(m));
		return path === item.href || path.startsWith(item.href + '/');
	}

	// Portrait is a bottom tab bar (an iPhone in your hand, or a portrait-
	// mounted kiosk) — there's no room for 11 items without either scrolling
	// with zero visible hint that more exist off-screen, or a proper "More"
	// overflow tab like every native iOS app uses. Only split when it's
	// actually needed: everything fits without it, skip the extra tap.
	const PRIMARY_COUNT = 4;
	const isPortrait = $derived(family.orientation === 'portrait');
	const primary = $derived(
		isPortrait && visible.length > PRIMARY_COUNT + 1 ? visible.slice(0, PRIMARY_COUNT) : visible
	);
	const overflow = $derived(isPortrait ? visible.slice(primary.length) : []);
	const overflowActive = $derived(overflow.some(isActive));

	let moreOpen = $state(false);
</script>

<nav class="sidebar" data-orientation={family.orientation} aria-label="Main">
	<div class="brand" aria-hidden="true">
		<span class="mark">🗓️</span>
	</div>
	<ul>
		{#each primary as item (item.href)}
			{@const Ico = item.icon}
			<li>
				{#if item.soon}
					<span class="item soon" title="{item.label} — coming soon">
						<Ico size={24} strokeWidth={1.9} />
						<span class="label type-caption">{item.label}</span>
					</span>
				{:else}
					<a class="item pressable" class:active={isActive(item)} href={item.href}>
						<Ico size={24} strokeWidth={1.9} />
						<span class="label type-caption">{item.label}</span>
					</a>
				{/if}
			</li>
		{/each}
		{#if overflow.length}
			<li>
				<button
					type="button"
					class="item pressable"
					class:active={overflowActive}
					onclick={() => (moreOpen = true)}
				>
					<MoreHorizontal size={24} strokeWidth={1.9} />
					<span class="label type-caption">More</span>
				</button>
			</li>
		{/if}
	</ul>
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
			{#each overflow as item (item.href)}
				{@const Ico = item.icon}
				<li>
					{#if item.soon}
						<span class="srow soon" title="{item.label} — coming soon">
							<Ico size={22} strokeWidth={1.9} />
							<span class="type-body-lg">{item.label}</span>
						</span>
					{:else}
						<a
							class="srow pressable"
							class:active={isActive(item)}
							href={item.href}
							onclick={() => (moreOpen = false)}
						>
							<Ico size={22} strokeWidth={1.9} />
							<span class="type-body-lg">{item.label}</span>
						</a>
					{/if}
				</li>
			{/each}
		</ul>
	</div>
{/if}

<style>
	.sidebar {
		width: 84px;
		flex: none;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-4) 0;
		background: var(--material-thick);
		backdrop-filter: var(--material-blur);
		border-right: 1px solid var(--color-border-subtle);
		overflow-y: auto;
	}
	.brand {
		margin-bottom: var(--space-2);
	}
	.mark {
		font-size: 1.6rem;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
		width: 100%;
	}
	.item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 5px;
		padding: 10px 4px;
		margin: 0 8px;
		border-radius: var(--radius-md);
		color: var(--color-text-secondary);
	}
	.item.active {
		color: var(--color-text-primary);
		background: var(--color-surface);
		box-shadow: var(--shadow-card);
	}
	.item.soon {
		color: var(--color-text-tertiary);
		opacity: 0.6;
		cursor: default;
	}
	.label {
		text-align: center;
	}

	/* Portrait: a horizontal bottom bar, capped to a few items (+ "More") so
	   everything is always visible at once — no scrolling with no indication
	   there's more off-screen. */
	.sidebar[data-orientation='portrait'] {
		width: 100%;
		height: auto;
		flex-direction: row;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-4)
			max(var(--space-2), env(safe-area-inset-bottom, var(--space-2)));
		border-right: none;
		border-top: 1px solid var(--color-border-subtle);
	}
	.sidebar[data-orientation='portrait'] .brand {
		display: none;
	}
	.sidebar[data-orientation='portrait'] ul {
		flex-direction: row;
		justify-content: space-around;
		gap: 2px;
		width: 100%;
	}
	.sidebar[data-orientation='portrait'] .item {
		flex-direction: column;
		padding: 8px 12px;
		margin: 0;
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
		padding: 14px var(--space-3);
		border-radius: var(--radius-md);
		color: var(--color-text-secondary);
	}
	.srow.active {
		color: var(--color-text-primary);
		background: var(--color-surface-elevated);
		font-weight: var(--weight-semibold);
	}
	.srow.soon {
		opacity: 0.5;
	}
</style>
