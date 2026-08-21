<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { mirror } from '$lib/stores/mirror.svelte';
	import { Smartphone, X } from 'lucide-svelte';

	let qrSvg = $state('');
	let url = $state('');
	let err = $state(false);

	onMount(() => {
		fetch('/api/mirror/start', { method: 'POST' })
			.then((r) => (r.ok ? r.json() : Promise.reject()))
			.then((d) => {
				qrSvg = d.qrSvg;
				url = d.url;
				// This device is now the TV/display for that token.
				mirror.becomeDisplay(d.token);
			})
			.catch(() => (err = true));
	});
</script>

<div class="pair">
	<button type="button" class="close" aria-label="Back to dashboard" onclick={() => goto('/')}>
		<X size={26} />
	</button>

	<div class="inner">
		<h1 class="title"><Smartphone size={34} /> Add events from your phone</h1>

		{#if err}
			<p class="sub">Couldn't start the pairing session. Go back and try again.</p>
		{:else if qrSvg}
			<div class="qr">
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				{@html qrSvg}
			</div>
			<ol class="steps">
				<li>Open your phone camera and point it at this code</li>
				<li>Tap the link that appears</li>
				<li>Add events there — they show up here right away</li>
			</ol>
			<code class="url">{url}</code>
		{:else}
			<div class="qr placeholder"></div>
			<p class="sub">Preparing pairing code…</p>
		{/if}
	</div>
</div>

<style>
	.pair {
		position: fixed;
		inset: 0;
		z-index: 300;
		background: var(--color-surface, #fff);
		display: grid;
		place-items: center;
		padding: 4vmin;
	}
	.close {
		position: absolute;
		top: 3vmin;
		right: 3vmin;
		display: grid;
		place-items: center;
		width: 56px;
		height: 56px;
		border-radius: 50%;
		background: var(--color-surface-elevated, #f0eee9);
		color: var(--color-text-secondary, #555);
	}
	.inner {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 3vmin;
		text-align: center;
		max-width: 640px;
	}
	.title {
		display: flex;
		align-items: center;
		gap: 12px;
		font-size: clamp(1.4rem, 3.6vw, 2.4rem);
		font-weight: 700;
		color: var(--color-text-primary, #1a1a1a);
	}
	.qr {
		width: min(52vmin, 460px);
		height: min(52vmin, 460px);
		background: #fff;
		padding: 3%;
		border-radius: 20px;
		box-shadow: var(--shadow-float, 0 20px 50px rgba(0, 0, 0, 0.15));
	}
	.qr :global(svg) {
		width: 100%;
		height: 100%;
		display: block;
	}
	.qr.placeholder {
		background: var(--color-surface-elevated, #f0eee9);
	}
	.steps {
		text-align: left;
		display: flex;
		flex-direction: column;
		gap: 8px;
		font-size: clamp(1rem, 2.2vw, 1.4rem);
		color: var(--color-text-secondary, #555);
		margin: 0;
		padding-left: 1.4em;
	}
	.sub {
		color: var(--color-text-secondary, #555);
		font-size: 1.2rem;
	}
	.url {
		font-family: ui-monospace, monospace;
		font-size: 0.9rem;
		color: var(--color-text-tertiary, #999);
		word-break: break-all;
	}
</style>
