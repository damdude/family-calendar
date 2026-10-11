<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { mirror } from '$lib/stores/mirror.svelte';
	import RecoveryCode from '$lib/components/RecoveryCode.svelte';
	import UpdateOverlay from '$lib/components/UpdateOverlay.svelte';

	let { children } = $props();

	// DISPLAY (TV): track whether a phone is actively paired right now (drives
	// the QR ↔ "Phone paired" swap), and follow whichever top-level tab the
	// phone companion page is currently on (Calendar/Lists/Tasks/…) so an
	// edit made there is visible here right away — not a full mirror of the
	// phone's UI, just which section is showing.
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

	// COMPANION (phone): heartbeat so the TV's "phone paired" status reflects
	// that this session is still open, and report the active tab (set by the
	// /remote page itself) so the display can follow it — the phone stays on
	// /remote the whole time now, so /pair (the TV-side full-screen QR) is
	// the only path excluded.
	$effect(() => {
		if (mirror.role !== 'controller' || !mirror.token) return;
		// /remote itself calls mirror.reportPath() immediately on every tab
		// switch (and the Settings link does the same before it navigates
		// away) — this interval exists only to resend after a dropped
		// request or a missed tick, not to discover the path in the first
		// place, which is why it is safe to keep reading the same
		// mirror.activePath rather than page.url.pathname: the latter is
		// only a fallback for the short window before the page has set one.
		const report = () => {
			if (page.url.pathname.startsWith('/pair')) return;
			mirror.reportPath(mirror.activePath ?? page.url.pathname);
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

<!-- Only ever visible on the kiosk itself: the code endpoint refuses anything
     that is not loopback, which is what makes it proof of being in the room. -->
<RecoveryCode />

<!-- Global, not route-gated: whichever screen is being looked at during an
     install should show it, same as the recovery code above. -->
<UpdateOverlay />
