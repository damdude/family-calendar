<script lang="ts">
	import { page } from '$app/state';
	import { family } from '$lib/stores/family.svelte';
	import AgeAdaptive from '$lib/ui/AgeAdaptive.svelte';
	import { ArrowLeft } from 'lucide-svelte';

	const profile = $derived(family.profile(Number(page.params.id)));
</script>

<div class="profile-page">
	<a class="back pressable type-label" href="/">
		<ArrowLeft size={18} /> All calendars
	</a>

	{#if profile}
		<AgeAdaptive {profile} />
	{:else}
		<p class="type-title">Profile not found</p>
	{/if}
</div>

<style>
	.profile-page {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding-bottom: var(--space-6);
	}
	.back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		align-self: flex-start;
		padding: 7px 14px 7px 10px;
		border-radius: var(--radius-pill);
		background: var(--color-surface);
		box-shadow: var(--shadow-card);
		color: var(--color-text-secondary);
	}
</style>
