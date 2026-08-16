<script lang="ts">
	/**
	 * Always-available "control this screen from your phone" QR.
	 *
	 * A device with no touch at all keeps the code on screen permanently —
	 * there's no other input method, so the QR must be scannable at any moment
	 * without someone first finding a button to reveal it. Every touch-capable
	 * device collapses it to a small icon instead, tapped open when wanted.
	 *
	 * Deliberately keyed off *this device's* real touch support, not the
	 * household's `displayMode` setting — that describes the one fixed kiosk,
	 * but every family member's own phone loads the same app and has touch,
	 * so it should never get the permanent, unclosable version either.
	 */
	import { onMount } from 'svelte';
	import { family } from '$lib/stores/family.svelte';
	import { mirror } from '$lib/stores/mirror.svelte';
	import { QrCode, X, Smartphone } from 'lucide-svelte';

	let qrSvg = $state('');
	let url = $state('');
	let expanded = $state(false);

	// Only the display side shows a QR; a phone acting as controller must not.
	const show = $derived(mirror.role !== 'controller');
	// Best-guess default before mount (matches the common case: the fixed
	// kiosk itself), corrected to the device's real capability once known.
	let noTouch = $state(family.displayMode !== 'touch');
	onMount(() => {
		noTouch = !(
			(typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) ||
			navigator.maxTouchPoints > 0
		);
	});

	async function load() {
		try {
			const r = await fetch('/api/mirror/start', { method: 'POST' });
			if (!r.ok) return;
			const d = await r.json();
			qrSvg = d.qrSvg;
			url = d.url;
			mirror.becomeDisplay(d.token);
		} catch {
			/* offline — no QR to show */
		}
	}

	$effect(() => {
		if (!show) return;
		// Fetch once per display session. The token stays valid while this screen
		// holds its event-stream subscription, so it never needs re-issuing —
		// re-issuing would in fact orphan a phone that's already paired.
		if (!qrSvg) load();
	});
</script>

{#if show}
	{#if noTouch}
		<!-- No touch at all: the QR is the only way in, so it's permanent and
		     un-dismissable — but once a phone has actually paired, showing it is
		     pointless (and confusing, since scanning it again does nothing
		     useful). The TopBar's "Phone paired" badge covers the status while
		     paired; this panel just goes quiet until that phone disconnects,
		     when the QR reappears automatically. -->
		{#if !mirror.controllerConnected && qrSvg}
			<aside class="tvqr" aria-label="Control from your phone">
				<div class="qr">
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					{@html qrSvg}
				</div>
				<div class="cap">
					<span class="type-label"><Smartphone size={14} /> Control from your phone</span>
					<span class="type-caption sub">Scan to add events, lists and more</span>
				</div>
			</aside>
		{/if}
	{:else}
		<!-- Has touch: out of the way until asked for, on this device only. -->
		<button
			type="button"
			class="fab"
			class:portrait={family.orientation === 'portrait'}
			aria-label="Control from your phone"
			onclick={() => (expanded = true)}
		>
			<QrCode size={22} />
		</button>

		{#if expanded}
			<div
				class="scrim"
				role="button"
				tabindex="-1"
				aria-label="Close"
				onclick={() => (expanded = false)}
				onkeydown={(e) => e.key === 'Escape' && (expanded = false)}
			></div>
			<div class="modal" role="dialog" aria-modal="true">
				<header class="mhead">
					<h2 class="type-title"><Smartphone size={20} /> Control from your phone</h2>
					<button type="button" class="close" aria-label="Close" onclick={() => (expanded = false)}
						><X size={20} /></button
					>
				</header>
				{#if qrSvg}
					<div class="qr big">
						<!-- eslint-disable-next-line svelte/no-at-html-tags -->
						{@html qrSvg}
					</div>
					<p class="type-body sub">
						Scan with your phone camera. Whatever you open there, this screen follows.
					</p>
					<code class="url">{url}</code>
				{:else}
					<p class="type-body sub">Preparing…</p>
				{/if}
			</div>
		{/if}
	{/if}
{/if}

<style>
	.tvqr {
		position: fixed;
		right: var(--space-4);
		bottom: var(--space-4);
		z-index: 90;
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		box-shadow: var(--shadow-float);
	}
	.qr {
		width: clamp(96px, 11vmin, 150px);
		height: clamp(96px, 11vmin, 150px);
		flex: none;
	}
	.qr :global(svg) {
		width: 100%;
		height: 100%;
		display: block;
	}
	.cap {
		display: flex;
		flex-direction: column;
		gap: 2px;
		max-width: 190px;
	}
	.cap .type-label {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--color-text-primary);
	}
	.sub {
		color: var(--color-text-secondary);
	}
	.fab {
		position: fixed;
		right: var(--space-4);
		bottom: var(--space-4);
		z-index: 90;
		display: grid;
		place-items: center;
		width: 52px;
		height: 52px;
		border-radius: 50%;
		background: var(--color-surface);
		color: var(--color-text-secondary);
		box-shadow: var(--shadow-float);
	}
	/* Portrait puts the nav as a bottom bar — clear it rather than overlap. */
	.fab.portrait {
		bottom: calc(80px + env(safe-area-inset-bottom, 0px));
	}
	.fab:active {
		transform: translateY(1px);
	}
	.scrim {
		position: fixed;
		inset: 0;
		z-index: 150;
		background: rgba(20, 20, 20, 0.4);
		backdrop-filter: blur(2px);
	}
	.modal {
		position: fixed;
		z-index: 151;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		width: min(420px, calc(100vw - 32px));
		padding: var(--space-5);
		border-radius: var(--radius-xl);
		background: var(--color-surface);
		box-shadow: var(--shadow-float);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3);
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
		color: var(--color-text-primary);
	}
	.close {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border-radius: var(--radius-pill);
		color: var(--color-text-secondary);
	}
	.qr.big {
		width: min(300px, 68vw);
		height: min(300px, 68vw);
	}
	.url {
		font-family: ui-monospace, monospace;
		font-size: var(--text-xs);
		color: var(--color-text-tertiary);
		word-break: break-all;
	}
</style>
