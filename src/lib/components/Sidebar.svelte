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
		Settings,
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
			match: ['/profile', '/routine']
		},
		{ label: 'Lists', href: '/lists', icon: ClipboardList, feature: 'lists' },
		{ label: 'Tasks', href: '/tasks', icon: SquareCheckBig, feature: 'tasks', soon: true },
		{ label: 'Rewards', href: '/rewards', icon: Star, feature: 'rewards' },
		{ label: 'Meals', href: '/meals', icon: Utensils, feature: 'meals' },
		{ label: 'Recipes', href: '/recipes', icon: ChefHat, feature: 'recipes', soon: true },
		{ label: 'Photos', href: '/photos', icon: Image, feature: 'photos', soon: true },
		{ label: 'Sleep', href: '/sleep', icon: Moon, feature: 'sleep', soon: true },
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
</script>

<nav class="sidebar" data-orientation={family.orientation} aria-label="Main">
	<div class="brand" aria-hidden="true">
		<span class="mark">🗓️</span>
	</div>
	<ul>
		{#each visible as item (item.href)}
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
	</ul>
</nav>

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

	/* Portrait: a horizontal bottom bar. */
	.sidebar[data-orientation='portrait'] {
		width: 100%;
		height: auto;
		flex-direction: row;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-4);
		border-right: none;
		border-top: 1px solid var(--color-border-subtle);
		overflow-x: auto;
		overflow-y: hidden;
	}
	.sidebar[data-orientation='portrait'] .brand {
		display: none;
	}
	.sidebar[data-orientation='portrait'] ul {
		flex-direction: row;
		gap: 2px;
	}
	.sidebar[data-orientation='portrait'] .item {
		flex-direction: column;
		padding: 8px 12px;
		margin: 0;
	}
</style>
