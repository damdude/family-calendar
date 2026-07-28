<script lang="ts">
	import { untrack } from 'svelte';
	import { Newspaper, Plus, X, RefreshCw, ExternalLink } from 'lucide-svelte';

	interface SiteEntry {
		id: number;
		url: string;
		name: string;
		lastFetched?: number;
		title?: string;
		excerpt?: string;
		items?: string[];
	}

	let { profileId, initial = [] }: { profileId: number; initial?: SiteEntry[] } = $props();

	let sites = $state<SiteEntry[]>(untrack(() => [...initial]));
	let newUrl = $state('');
	let newName = $state('');
	let busy = $state(false);

	async function add() {
		const url = newUrl.trim();
		if (!url) return;
		busy = true;
		try {
			const res = await fetch('/api/sites', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ profileId, url, name: newName.trim() })
			});
			if (res.ok) {
				sites.push(await res.json());
				newUrl = '';
				newName = '';
			}
		} finally {
			busy = false;
		}
	}

	async function remove(id: number) {
		await fetch('/api/sites/remove', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ profileId, id })
		});
		sites = sites.filter((s) => s.id !== id);
	}

	async function refresh() {
		busy = true;
		try {
			await fetch('/api/sites/refresh', { method: 'POST' });
			const res = await fetch(`/api/sites?profileId=${profileId}`);
			if (res.ok) sites = (await res.json())[profileId] ?? [];
		} finally {
			busy = false;
		}
	}
</script>

<section class="sites">
	<header class="shead">
		<h2 class="type-heading"><Newspaper size={20} /> Sites of Interest</h2>
		{#if sites.length}
			<button type="button" class="refresh" disabled={busy} onclick={refresh} aria-label="Refresh">
				<RefreshCw size={16} />
			</button>
		{/if}
	</header>

	{#each sites as site (site.id)}
		<article class="site">
			<div class="sitehead">
				<a class="sname" href={site.url} target="_blank" rel="noopener noreferrer">
					{site.name}
					<ExternalLink size={13} />
				</a>
				<button
					type="button"
					class="del"
					aria-label="Remove {site.name}"
					onclick={() => remove(site.id)}
				>
					<X size={14} />
				</button>
			</div>
			{#if site.items?.length}
				<ul class="headlines">
					{#each site.items as h (h)}<li class="type-body">{h}</li>{/each}
				</ul>
			{:else if site.excerpt}
				<p class="type-body excerpt">{site.excerpt}</p>
			{:else}
				<p class="type-caption pending">Fetching latest…</p>
			{/if}
		</article>
	{/each}

	<div class="addrow">
		<input
			class="in"
			type="url"
			placeholder="https://school.example.com/news"
			bind:value={newUrl}
		/>
		<input class="in name" type="text" placeholder="Label" bind:value={newName} />
		<button type="button" class="add" disabled={busy || !newUrl.trim()} onclick={add}>
			<Plus size={16} /> Add
		</button>
	</div>
</section>

<style>
	.sites {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.shead {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.shead h2 {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.refresh {
		display: grid;
		place-items: center;
		width: 34px;
		height: 34px;
		border-radius: var(--radius-pill);
		color: var(--color-text-secondary);
		background: var(--color-surface);
		box-shadow: var(--shadow-card);
	}
	.site {
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-card);
		padding: var(--space-4);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.sitehead {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.sname {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-weight: var(--weight-semibold);
		color: var(--color-text-primary);
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
		background: var(--color-surface-elevated);
	}
	.headlines {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.headlines li {
		padding-left: 14px;
		position: relative;
		color: var(--color-text-secondary);
	}
	.headlines li::before {
		content: '›';
		position: absolute;
		left: 0;
		color: var(--color-text-tertiary);
	}
	.excerpt {
		color: var(--color-text-secondary);
	}
	.pending {
		color: var(--color-text-tertiary);
	}
	.addrow {
		display: flex;
		gap: var(--space-2);
		flex-wrap: wrap;
	}
	.in {
		flex: 1;
		min-width: 140px;
		padding: 9px 12px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-border-subtle);
		background: var(--color-surface);
		color: var(--color-text-primary);
	}
	.in.name {
		flex: 0 0 120px;
		min-width: 90px;
	}
	.add {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 0 14px;
		border-radius: var(--radius-pill);
		background: var(--color-text-primary);
		color: var(--color-surface);
		font-weight: var(--weight-semibold);
	}
	.add:disabled {
		opacity: 0.45;
	}
</style>
