<script lang="ts">
	import { X, Smartphone } from 'lucide-svelte';

	let { onClose }: { onClose: () => void } = $props();

	let qrSvg = $state('');
	let url = $state('');
	let err = $state(false);

	$effect(() => {
		fetch('/api/quickadd/start', { method: 'POST' })
			.then((r) => (r.ok ? r.json() : Promise.reject()))
			.then((d) => {
				qrSvg = d.qrSvg;
				url = d.url;
			})
			.catch(() => (err = true));
	});
</script>

<div
	class="scrim"
	role="button"
	tabindex="-1"
	onclick={onClose}
	onkeydown={(e) => e.key === 'Escape' && onClose()}
></div>
<div class="modal" role="dialog" aria-modal="true" aria-label="Add from phone">
	<header class="mhead">
		<h2 class="type-title"><Smartphone size={20} /> Add from your phone</h2>
		<button type="button" class="close" aria-label="Close" onclick={onClose}><X size={20} /></button
		>
	</header>

	{#if err}
		<p class="type-body sub">Couldn't start. Try again.</p>
	{:else if qrSvg}
		<div class="qr">
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{@html qrSvg}
		</div>
		<p class="type-body sub">
			Scan this with your phone camera to add an event. It'll appear here instantly.
		</p>
		<code class="url">{url}</code>
	{:else}
		<p class="type-body sub">Preparing…</p>
	{/if}
</div>

<style>
	.scrim {
		position: fixed;
		inset: 0;
		z-index: 150;
		background: rgba(20, 20, 20, 0.35);
		backdrop-filter: blur(2px);
	}
	.modal {
		position: fixed;
		z-index: 151;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		width: min(360px, calc(100vw - 32px));
		background: var(--color-surface);
		border-radius: var(--radius-xl);
		box-shadow: var(--shadow-float);
		padding: var(--space-5);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-4);
		text-align: center;
	}
	.mhead {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
	}
	.mhead h2 {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.close {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border-radius: var(--radius-pill);
		color: var(--color-text-secondary);
	}
	.qr {
		width: 220px;
		height: 220px;
	}
	.qr :global(svg) {
		width: 100%;
		height: 100%;
	}
	.sub {
		color: var(--color-text-secondary);
	}
	.url {
		font-family: ui-monospace, monospace;
		font-size: var(--text-xs);
		color: var(--color-text-tertiary);
		word-break: break-all;
	}
</style>
