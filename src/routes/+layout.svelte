<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { mirror } from '$lib/stores/mirror.svelte';

	let { children } = $props();

	// DISPLAY (TV): track whether a phone is actively paired right now (drives
	// the QR ↔ "Phone paired" swap). The phone runs its own dedicated UI at
	// /remote now — it no longer reports a path for the TV to follow.
	$effect(() => {
		if (mirror.role !== 'display' || !mirror.token) return;
		const es = new EventSource(`/api/mirror/events?token=${mirror.token}`);
		es.onopen = () => (mirror.connected = true);
		es.onerror = () => (mirror.connected = false);
		es.addEventListener('status', (e) => {
			mirror.controllerConnected = (e as MessageEvent).data === 'true';
		});
		return () => {
			es.close();
			mirror.connected = false;
			mirror.controllerConnected = false;
		};
	});

	// COMPANION (phone): heartbeat so the TV's "phone paired" status reflects
	// that this session is still open — the phone stays on /remote the whole
	// time now, so /pair (the TV-side full-screen QR) is the only path excluded.
	$effect(() => {
		if (mirror.role !== 'controller' || !mirror.token) return;
		const report = () => {
			if (page.url.pathname.startsWith('/pair')) return;
			fetch('/api/mirror/nav', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ token: mirror.token, path: page.url.pathname })
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
