<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { mirror } from '$lib/stores/mirror.svelte';

	onMount(() => {
		const token = page.url.searchParams.get('token');
		if (token) mirror.becomeController(token);
		// Jump into the app as the controller.
		goto('/', { replaceState: true });
	});
</script>

<div class="connecting">
	<div class="spinner"></div>
	<p>Connecting to your TV…</p>
</div>

<style>
	.connecting {
		position: fixed;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 16px;
		background: var(--color-bg, #faf8f4);
		color: var(--color-text-secondary, #666);
		font-family: system-ui, sans-serif;
	}
	.spinner {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		border: 3px solid rgba(0, 0, 0, 0.12);
		border-top-color: currentColor;
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
