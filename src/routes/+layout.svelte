<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { mirror } from '$lib/stores/mirror.svelte';
	import { Radio, X } from 'lucide-svelte';

	let { children } = $props();

	// DISPLAY (TV): follow the controller's path over SSE, and track whether a
	// phone is actively paired right now (drives the QR ↔ "Phone paired" swap).
	$effect(() => {
		if (mirror.role !== 'display' || !mirror.token) return;
		const es = new EventSource(`/api/mirror/events?token=${mirror.token}`);
		es.onopen = () => (mirror.connected = true);
		es.onerror = () => (mirror.connected = false);
		es.onmessage = (e) => {
			const path = e.data;
			if (path && path.startsWith('/') && path !== page.url.pathname) {
				goto(path);
			}
		};
		es.addEventListener('status', (e) => {
			mirror.controllerConnected = (e as MessageEvent).data === 'true';
		});
		return () => {
			es.close();
			mirror.connected = false;
			mirror.controllerConnected = false;
		};
	});

	// CONTROLLER (phone): report our current in-app path to the TV, and keep
	// heartbeating on an interval even without navigating — the display's
	// "phone paired" status is based on how recently it last heard from us,
	// not just on the last screen we happened to visit.
	$effect(() => {
		if (mirror.role !== 'controller' || !mirror.token) return;
		const report = () => {
			const path = page.url.pathname;
			if (path.startsWith('/remote') || path.startsWith('/pair')) return;
			fetch('/api/mirror/nav', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ token: mirror.token, path })
			}).catch(() => {});
		};
		report();
		const id = setInterval(report, 5000);
		return () => clearInterval(id);
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Family Calendar</title>
</svelte:head>

{@render children()}

{#if mirror.role === 'controller'}
	<div class="ctrl-banner">
		<Radio size={16} />
		<span>Controlling the TV</span>
		<button type="button" class="stop" aria-label="Stop controlling" onclick={() => mirror.stop()}>
			<X size={15} />
		</button>
	</div>
{/if}

<style>
	.ctrl-banner {
		position: fixed;
		left: 50%;
		bottom: 16px;
		transform: translateX(-50%);
		z-index: 400;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 10px 8px 16px;
		border-radius: 999px;
		background: #1f8a4c;
		color: #fff;
		font-weight: 600;
		font-size: 0.9rem;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
	}
	.stop {
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.2);
		color: #fff;
	}
</style>
