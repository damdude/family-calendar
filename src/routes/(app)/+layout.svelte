<script lang="ts">
	import { family } from '$lib/stores/family.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import TopBar from '$lib/components/TopBar.svelte';
	import { dragScroll } from '$lib/actions/dragScroll';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	// Apply persisted config (family name, profiles, feature flags, orientation)
	// and kid progress (streaks, completions, feelings) onto the store.
	$effect(() => {
		family.applyConfig(data.config);
		family.applyProgress(data.progress);
		family.applyFamilyData(data.familyData);
		family.applySyncedEvents(data.syncedEvents);
	});
</script>

<div class="app" data-orientation={family.orientation}>
	<Sidebar />
	<div class="content">
		<TopBar />
		<main use:dragScroll>
			{@render children()}
		</main>
	</div>
</div>

<style>
	.app {
		display: flex;
		height: 100vh;
		width: 100vw;
		overflow: hidden;
	}
	.content {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
		min-height: 0;
		background: var(--color-canvas);
	}
	main {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 0 var(--space-6) var(--space-6);
		touch-action: pan-y;
	}
	main:global(.dragging) {
		user-select: none;
		cursor: grabbing;
	}

	/* Portrait: nav moves to the bottom as a horizontal bar. */
	.app[data-orientation='portrait'] {
		flex-direction: column;
	}
	.app[data-orientation='portrait'] .content {
		order: 1;
	}
	.app[data-orientation='portrait'] :global(.sidebar) {
		order: 2;
	}
</style>
