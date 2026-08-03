<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';
	import type { SetupDraft, KioskEvent } from '$lib/setup/types';
	import { profileTint } from '$lib/design/colors';
	import Confetti from '$lib/components/Confetti.svelte';
	import { Smartphone, Wifi } from 'lucide-svelte';

	let { data }: { data: PageData } = $props();

	let draft = $state<SetupDraft | null>(null);
	let paired = $state(false);
	let complete = $state(false);

	// Phase 1 (offline): poll until the Pi joins the home network, then reload so
	// the pairing QR uses the freshly-assigned LAN address.
	$effect(() => {
		if (data.online) return;
		const id = setInterval(async () => {
			try {
				const r = await fetch('/api/net/status');
				if (r.ok && (await r.json()).online) invalidateAll();
			} catch {
				/* still offline */
			}
		}, 3000);
		return () => clearInterval(id);
	});

	// Phase 1 debug panel: a static, fixed-size snapshot of Wi-Fi bring-up state
	// (systemd, rfkill, nmcli, recent log lines) — the only way to see what the
	// Pi is doing when it has no network for SSH/logs to reach. Refreshes in
	// place so a screenshot always shows the latest lines without scrolling.
	let debugLog = $state('');
	let debugAt = $state<number | null>(null);
	$effect(() => {
		if (data.online) return;
		let cancelled = false;
		const poll = async () => {
			try {
				const r = await fetch('/api/net/debug');
				if (r.ok && !cancelled) {
					const d = await r.json();
					debugLog = d.log;
					debugAt = d.at;
				}
			} catch {
				/* leave last snapshot on screen */
			}
		};
		poll();
		const id = setInterval(poll, 4000);
		return () => {
			cancelled = true;
			clearInterval(id);
		};
	});

	// Phase 2 (online): listen for the phone completing the wizard.
	$effect(() => {
		if (!data.online) return;
		const es = new EventSource(`/setup/events?token=${data.token}`);
		es.onmessage = (e) => {
			const msg: KioskEvent = JSON.parse(e.data);
			if (msg.type === 'draft') {
				draft = msg.draft;
				paired = true;
			} else if (msg.type === 'complete') {
				complete = true;
				es.close();
				setTimeout(() => goto('/'), 2600);
			}
		};
		return () => es.close();
	});

	const hasContent = $derived(!!draft && (draft.family.name || draft.profiles.length > 0));
</script>

<div class="setup">
	<Confetti active={complete} />

	{#if !data.online}
		<!-- Phase 1: get the Pi onto Wi-Fi via its own setup hotspot -->
		<div class="left">
			<div class="brandrow">
				<span class="logo">🗓️</span>
				<div>
					<h1 class="type-title-lg">Family Calendar</h1>
					<p class="type-body-lg sub">Step 1 of 2 — connect me to Wi-Fi</p>
				</div>
			</div>

			<div class="qrcard">
				<div class="qr">
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					{@html data.wifiQrSvg}
				</div>
				<div class="scan">
					<p class="type-heading"><Wifi size={20} /> Join my Wi-Fi hotspot</p>
					<p class="type-body sub">
						Scan this with your phone camera and tap <strong>Join “{data.apSsid}”</strong>. A setup
						page opens automatically — pick your home Wi-Fi and enter its password.
					</p>
				</div>
			</div>

			<div class="fallback">
				<p class="type-label"><Smartphone size={16} /> No scan? On your phone:</p>
				<ol class="steps">
					<li>Open <strong>Settings → Wi-Fi</strong></li>
					<li>Join the network <strong>“{data.apSsid}”</strong></li>
					<li>Wait for the “Sign in” page, then choose your home Wi-Fi</li>
				</ol>
			</div>
		</div>

		<div class="right">
			<div class="preview">
				<span class="type-label previewlbl">Status</span>
				<div class="state waiting">
					<span class="dotpulse"></span>
					<span class="type-body-lg sub">Waiting to join your Wi-Fi…</span>
					<span class="type-caption sub">This screen continues on its own once I'm online.</span>
				</div>
			</div>

			<div class="debugbox">
				<div class="debughead">
					<span class="type-label">Debug info</span>
					{#if debugAt}
						<span class="type-caption sub">updated {new Date(debugAt).toLocaleTimeString()}</span>
					{/if}
				</div>
				<pre class="debuglog">{debugLog || 'Waiting for diagnostics…'}</pre>
			</div>
		</div>
	{:else}
		<div class="left">
			<div class="brandrow">
				<span class="logo">🗓️</span>
				<div>
					<h1 class="type-title-lg">Family Calendar</h1>
					<p class="type-body-lg sub">Let's get you set up</p>
				</div>
			</div>

			<div class="qrcard">
				<div class="qr">
					<!-- eslint-disable-next-line svelte/no-at-html-tags -->
					{@html data.qrSvg}
				</div>
				<div class="scan">
					<p class="type-heading"><Smartphone size={20} /> Scan with your phone</p>
					<p class="type-body sub">Point your camera at the code to open the setup wizard.</p>
				</div>
			</div>

			<div class="fallback">
				<p class="type-label"><Wifi size={16} /> Or type this on your phone's browser:</p>
				<code class="url">{data.mdnsUrl}</code>
				<code class="url alt">{data.pairUrl}</code>
			</div>

			{#if data.alreadyComplete}
				<p class="type-caption note">
					This device is already set up — completing the wizard will reconfigure it.
				</p>
			{/if}
		</div>

		<div class="right">
			<div class="preview">
				<span class="type-label previewlbl">Live preview</span>
				{#if complete}
					<div class="state">
						<span class="big type-title">🎉 You're all set!</span>
						<span class="type-body-lg sub">Opening your dashboard…</span>
					</div>
				{:else if !hasContent}
					<div class="state waiting">
						<span class="dotpulse"></span>
						<span class="type-body-lg sub">
							{paired ? 'Connected! Fill in the wizard on your phone…' : 'Waiting for your phone…'}
						</span>
					</div>
				{:else if draft}
					<div class="previewbody">
						<h2 class="type-title-lg fam">{draft.family.name || 'Your Family'}</h2>
						{#if draft.profiles.length}
							<div class="pills">
								{#each draft.profiles as p (p.id)}
									<span class="ppill" style:background={profileTint(p.color, 34)}>
										<span class="pav" style:background={profileTint(p.color, 55)}
											>{p.avatarEmoji}</span
										>
										<span class="type-label">{p.name}</span>
										<span class="type-caption age">{p.age}</span>
									</span>
								{/each}
							</div>
						{:else}
							<p class="type-body sub">Add people on your phone and they'll appear here.</p>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.setup {
		min-height: 100vh;
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-6);
		padding: var(--space-8);
		background: linear-gradient(135deg, #fdf3f7 0%, var(--color-canvas) 45%, #eef6fb 100%);
	}
	.left,
	.right {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
		justify-content: center;
	}
	.brandrow {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.logo {
		font-size: 2.6rem;
	}
	.sub {
		color: var(--color-text-secondary);
	}
	.qrcard {
		display: flex;
		align-items: center;
		gap: var(--space-5);
		padding: var(--space-5);
		background: var(--color-surface);
		border-radius: var(--radius-xl);
		box-shadow: var(--shadow-raised);
	}
	.qr {
		width: 200px;
		height: 200px;
		flex: none;
	}
	.qr :global(svg) {
		width: 100%;
		height: 100%;
		display: block;
	}
	.scan p:first-child {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.fallback {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.fallback .type-label {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--color-text-secondary);
	}
	.url {
		font-family: ui-monospace, monospace;
		font-size: var(--text-sm);
		padding: 8px 12px;
		border-radius: var(--radius-sm);
		background: var(--color-surface);
		box-shadow: inset 0 0 0 1px var(--color-border-subtle);
		color: var(--color-text-primary);
		word-break: break-all;
	}
	.url.alt {
		color: var(--color-text-tertiary);
	}
	.steps {
		margin: 0;
		padding-left: 1.3em;
		display: flex;
		flex-direction: column;
		gap: 6px;
		color: var(--color-text-secondary);
		font-size: var(--text-base);
	}
	.steps strong {
		color: var(--color-text-primary);
	}
	.note {
		color: var(--color-accent-warning);
	}

	.preview {
		flex: 1;
		max-height: 80vh;
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding: var(--space-6);
		border-radius: var(--radius-xl);
		background: var(--material-thin);
		backdrop-filter: var(--material-blur);
		box-shadow: var(--shadow-float);
		border: 1px solid rgba(255, 255, 255, 0.5);
		justify-content: center;
	}
	.debugbox {
		flex: none;
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius-lg);
		background: #14161a;
		box-shadow: var(--shadow-card);
	}
	.debughead {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-2);
	}
	.debughead .type-label {
		color: #d7dbe0;
	}
	.debughead .sub {
		color: #7d8590;
	}
	/* Fixed height + internal scroll: never grows past the screen, and a
	   screenshot always shows the latest lines regardless of log length. */
	.debuglog {
		margin: 0;
		height: 150px;
		overflow-y: auto;
		font-family: ui-monospace, 'SF Mono', 'Courier New', monospace;
		font-size: 0.72rem;
		line-height: 1.5;
		color: #a7f3c8;
		white-space: pre-wrap;
		word-break: break-word;
	}
	.previewlbl {
		color: var(--color-text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		position: absolute;
		margin: calc(-1 * var(--space-4)) 0 0;
	}
	.state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
		text-align: center;
	}
	.waiting {
		gap: var(--space-4);
	}
	.dotpulse {
		width: 16px;
		height: 16px;
		border-radius: var(--radius-pill);
		background: var(--color-profile-blue);
		animation: pulse 1.4s var(--ease-standard) infinite;
	}
	@keyframes pulse {
		0%,
		100% {
			transform: scale(0.8);
			opacity: 0.5;
		}
		50% {
			transform: scale(1.3);
			opacity: 1;
		}
	}
	.previewbody {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	.fam {
		color: var(--color-text-primary);
	}
	.pills {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
	}
	.ppill {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 6px 14px 6px 6px;
		border-radius: var(--radius-pill);
	}
	.pav {
		display: grid;
		place-items: center;
		width: 34px;
		height: 34px;
		border-radius: var(--radius-pill);
		font-size: 1.15rem;
	}
	.age {
		color: var(--color-text-tertiary);
	}
	@media (prefers-reduced-motion: reduce) {
		.dotpulse {
			animation: none;
		}
	}
	@media (max-width: 820px) {
		.setup {
			grid-template-columns: 1fr;
		}
	}
</style>
