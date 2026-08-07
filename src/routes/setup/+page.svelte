<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import type { PageData } from './$types';
	import type { SetupDraft, KioskEvent } from '$lib/setup/types';
	import { profileTint } from '$lib/design/colors';
	import Confetti from '$lib/components/Confetti.svelte';
	import ModePicker from '$lib/components/ModePicker.svelte';
	import WifiPicker from '$lib/components/WifiPicker.svelte';
	import GoogleConnect from '$lib/components/GoogleConnect.svelte';
	import TouchFamilySetup from '$lib/components/TouchFamilySetup.svelte';
	import { Smartphone, Wifi, CalendarDays, ArrowLeft, WifiOff } from 'lucide-svelte';

	let { data }: { data: PageData } = $props();

	let draft = $state<SetupDraft | null>(null);
	let paired = $state(false);
	let complete = $state(false);

	// --- Step 0: TV or touchscreen? ---------------------------------------
	// Nothing else can be presented sensibly until we know whether this screen
	// accepts touch, so this gates the whole flow.
	async function chooseMode(mode: 'tv' | 'touch') {
		await fetch('/api/display-mode', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ displayMode: mode })
		}).catch(() => {});
		invalidateAll();
	}

	async function skipWifi() {
		await fetch('/api/display-mode', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ wifiSkipped: true })
		}).catch(() => {});
		invalidateAll();
	}

	// Back to the mode picker from any later step. Nothing else is undone —
	// Wi-Fi that's already joined stays joined, so re-picking a mode just falls
	// straight through to whatever step comes next (no re-work, no data loss).
	async function backToModePicker() {
		await fetch('/api/display-mode', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ displayMode: null })
		}).catch(() => {});
		invalidateAll();
	}

	const needsMode = $derived(data.displayMode === null);
	const isTouch = $derived(data.displayMode === 'touch');
	// Wi-Fi step is done when we're online, or the family chose to skip it.
	const needsWifi = $derived(!needsMode && !data.online && !data.wifiSkipped);
	const pastWifiStep = $derived(!needsMode && !needsWifi);
	// TV, Wi-Fi skipped, and genuinely still offline: there is no network for a
	// phone to reach this device over, so the pairing QR (which needs one) can't
	// be shown — it would just display a dead URL. Touch mode has no such gap:
	// it never needed a phone in the first place.
	const showOfflineCantPair = $derived(pastWifiStep && !isTouch && !data.online);

	async function retryWifi() {
		await fetch('/api/display-mode', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ wifiSkipped: false })
		}).catch(() => {});
		invalidateAll();
	}

	function touchSetupComplete(familyName: string) {
		completedFamilyName = familyName;
		complete = true;
		setTimeout(() => goto('/'), 2600);
	}
	let completedFamilyName = $state('');

	// Watch connectivity in BOTH directions and reload whenever it flips, so the
	// screen always self-corrects: offline → online swaps the join-hotspot QR for
	// a pairing QR carrying the freshly-assigned LAN address, and online → offline
	// (e.g. the hotspot restarting) returns to the join step instead of stranding
	// the display on a stale, unreachable URL. Only relevant while a network
	// change could still change what's on screen — not once touch's on-screen
	// setup or TV's real pairing screen are already showing.
	$effect(() => {
		if (needsMode) return;
		if (pastWifiStep && !showOfflineCantPair) return;
		const wasOnline = data.online;
		const id = setInterval(async () => {
			try {
				const r = await fetch('/api/net/status');
				if (!r.ok) return;
				const { online } = await r.json();
				if (online !== wasOnline) invalidateAll();
			} catch {
				/* transient — keep the current screen */
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
		if (!needsWifi || isTouch) return;
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

	// Pairing step: listen for the phone completing the wizard. Touch mode
	// completes locally (touchSetupComplete) — there's no phone in that flow.
	$effect(() => {
		if (needsMode || needsWifi || isTouch) return;
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

<Confetti active={complete} />

{#if needsMode}
	<!-- Step 0: TV or touchscreen — everything downstream depends on it. -->
	<ModePicker onchoose={chooseMode} />
{:else if needsWifi && isTouch}
	<!-- Touch: pick the network right here, no phone involved. -->
	<div class="touchwifi">
		<button type="button" class="stepback" onclick={backToModePicker}>
			<ArrowLeft size={16} /> Change screen type
		</button>
		<header class="brandrow">
			<span class="logo">🗓️</span>
			<div>
				<h1 class="type-title-lg">Family Calendar</h1>
				<p class="type-body-lg sub">Connect to Wi-Fi</p>
			</div>
		</header>
		<div class="touchcard">
			<WifiPicker onjoined={() => invalidateAll()} />
		</div>
		<button type="button" class="skip" onclick={skipWifi}>Set up Wi-Fi later</button>
	</div>
{:else if needsWifi}
	<!-- TV: no touch here, so hand Wi-Fi off to a phone via the hotspot. Still
	     offer "back": this may be a touch-capable screen someone chose TV mode
	     for, and they should be able to reconsider. -->
	<div class="setup">
		<div class="left">
			<button type="button" class="stepback" onclick={backToModePicker}>
				<ArrowLeft size={16} /> Change screen type
			</button>
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

			<button type="button" class="skip" onclick={skipWifi}>Set up Wi-Fi later</button>
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
	</div>
{:else if isTouch}
	<!-- Touch: family + profiles entered right here, no phone involved. -->
	<div class="touchwifi">
		{#if complete}
			<div class="donecard">
				<span class="big type-title">🎉 You're all set!</span>
				<p class="type-body-lg sub">Opening {completedFamilyName || 'your'} dashboard…</p>
			</div>
		{:else}
			<button type="button" class="stepback" onclick={backToModePicker}>
				<ArrowLeft size={16} /> Change screen type
			</button>
			<TouchFamilySetup token={data.token} oncomplete={touchSetupComplete} />
		{/if}
	</div>
{:else if data.online}
	<!-- TV, online: hand family + profile entry to a phone. -->
	<div class="setup">
		<div class="left">
			<button type="button" class="stepback" onclick={backToModePicker}>
				<ArrowLeft size={16} /> Change screen type
			</button>
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

			<!-- Sign in to Google here rather than pasting a share link. Uses the
			     device flow: a short code is shown, approved on a phone/laptop —
			     no Google password is ever typed into this appliance. -->
			<div class="gcard">
				<p class="type-label"><CalendarDays size={16} /> Google Calendar (optional)</p>
				<p class="type-caption sub">
					Sign in to pull in your existing calendars. You can also do this later in Settings.
				</p>
				<GoogleConnect />
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
	</div>
{:else}
	<!-- TV, Wi-Fi skipped, still genuinely offline: no network exists for a
	     phone to reach this device over, so there is no QR that could work. -->
	<div class="touchwifi">
		<button type="button" class="stepback" onclick={backToModePicker}>
			<ArrowLeft size={16} /> Change screen type
		</button>
		<div class="offlinecard">
			<WifiOff size={44} />
			<h1 class="type-title">No Wi-Fi yet</h1>
			<p class="type-body-lg sub">
				A phone can only reach this display once it's on your network — and there's nothing to scan
				without one.
			</p>
			<button type="button" class="btn primary" onclick={retryWifi}>Set up Wi-Fi now</button>
		</div>
	</div>
{/if}

<style>
	.touchwifi {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-4);
		padding: 3vmin;
		background: linear-gradient(135deg, #fdf3f7 0%, var(--color-canvas) 45%, #eef6fb 100%);
	}
	.touchcard {
		width: min(760px, 100%);
		padding: clamp(16px, 3vmin, 32px);
		border-radius: var(--radius-xl);
		background: var(--color-surface);
		box-shadow: var(--shadow-float);
	}
	.donecard,
	.offlinecard {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3);
		width: min(480px, 100%);
		padding: clamp(24px, 4vmin, 44px);
		border-radius: var(--radius-xl);
		background: var(--color-surface);
		box-shadow: var(--shadow-float);
		text-align: center;
	}
	.offlinecard :global(svg) {
		color: var(--color-text-tertiary);
	}
	.btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 14px 26px;
		border-radius: var(--radius-pill);
		font-weight: var(--weight-semibold);
		font-size: var(--text-lg);
	}
	.btn.primary {
		background: var(--color-text-primary);
		color: var(--color-surface);
	}
	.gcard {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: var(--space-4);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		box-shadow: var(--shadow-card);
	}
	.gcard .type-label {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--color-text-primary);
	}
	.gcard .sub {
		color: var(--color-text-secondary);
	}
	.stepback {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		align-self: flex-start;
		padding: 8px 14px;
		border-radius: var(--radius-pill);
		background: var(--color-surface-elevated);
		color: var(--color-text-secondary);
		font-weight: var(--weight-medium);
		font-size: var(--text-sm);
	}
	.skip {
		align-self: center;
		padding: 12px 22px;
		border-radius: var(--radius-pill);
		background: transparent;
		color: var(--color-text-secondary);
		font-weight: var(--weight-medium);
		text-decoration: underline;
	}
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
