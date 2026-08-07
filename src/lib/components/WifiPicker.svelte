<script lang="ts">
	/**
	 * On-screen Wi-Fi setup for touch mode: scan, pick a network, type the
	 * password with the virtual keyboard, join. No phone needed.
	 */
	import OnScreenKeyboard from './OnScreenKeyboard.svelte';
	import { Wifi, Lock, RefreshCw, Check, ArrowLeft } from 'lucide-svelte';

	let { onjoined }: { onjoined?: () => void } = $props();

	interface WifiNetwork {
		ssid: string;
		signal: number;
		secured: boolean;
		active: boolean;
	}

	let networks = $state<WifiNetwork[]>([]);
	let scanning = $state(false);
	let scanned = $state(false);
	let selected = $state<WifiNetwork | null>(null);
	let password = $state('');
	let joining = $state(false);
	let errorMsg = $state('');

	async function scan() {
		scanning = true;
		errorMsg = '';
		try {
			const r = await fetch('/api/net/wifi/scan');
			if (r.ok) networks = (await r.json()).networks ?? [];
			scanned = true;
		} catch {
			errorMsg = "Couldn't scan for networks.";
		} finally {
			scanning = false;
		}
	}

	$effect(() => {
		scan();
	});

	function pick(net: WifiNetwork) {
		selected = net;
		password = '';
		errorMsg = '';
		if (!net.secured) join();
	}

	async function join() {
		if (!selected) return;
		joining = true;
		errorMsg = '';
		try {
			const r = await fetch('/api/net/wifi/join', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ ssid: selected.ssid, password })
			});
			const res = await r.json().catch(() => ({}));
			if (r.ok && res.ok) {
				password = '';
				onjoined?.();
			} else {
				errorMsg = res.error ?? 'Could not join that network.';
			}
		} catch {
			errorMsg = 'Could not join that network.';
		} finally {
			joining = false;
		}
	}

	/** Signal strength → 1–4 bars, for a simple visual. */
	function bars(signal: number): string {
		const n = signal >= 75 ? 4 : signal >= 50 ? 3 : signal >= 25 ? 2 : 1;
		return '▮'.repeat(n) + '▯'.repeat(4 - n);
	}
</script>

<div class="wifi">
	{#if !selected}
		<div class="head">
			<p class="type-heading"><Wifi size={20} /> Choose your Wi-Fi network</p>
			<button type="button" class="rescan" disabled={scanning} onclick={scan}>
				<RefreshCw size={16} />
				{scanning ? 'Scanning…' : 'Rescan'}
			</button>
		</div>

		{#if scanning && networks.length === 0}
			<p class="type-body sub">Looking for networks…</p>
		{:else if scanned && networks.length === 0}
			<p class="type-body sub">No networks found. Make sure Wi-Fi is in range, then tap Rescan.</p>
		{/if}

		<ul class="list">
			{#each networks as net (net.ssid)}
				<li>
					<button type="button" class="net" onclick={() => pick(net)}>
						<span class="sig" aria-hidden="true">{bars(net.signal)}</span>
						<span class="ssid type-body-lg">{net.ssid}</span>
						{#if net.active}<span class="badge"><Check size={13} /> connected</span>{/if}
						{#if net.secured}<Lock size={16} />{/if}
					</button>
				</li>
			{/each}
		</ul>
	{:else}
		<div class="head">
			<button type="button" class="back" onclick={() => (selected = null)}>
				<ArrowLeft size={18} /> Networks
			</button>
		</div>
		<p class="type-heading">{selected.ssid}</p>
		<p class="type-body sub">Enter the Wi-Fi password</p>

		<div class="pwrow">
			<input
				class="pw"
				type="text"
				readonly
				value={password.replace(/./g, '•')}
				aria-label="Password"
				placeholder="Tap the keys below"
			/>
			<button type="button" class="joinbtn" disabled={joining || !password} onclick={join}>
				{joining ? 'Joining…' : 'Join'}
			</button>
		</div>

		<OnScreenKeyboard bind:value={password} onenter={join} />
	{/if}

	{#if errorMsg}<p class="type-body err">{errorMsg}</p>{/if}
</div>

<style>
	.wifi {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}
	.head .type-heading {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--color-text-primary);
	}
	.sub {
		color: var(--color-text-secondary);
	}
	.rescan,
	.back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 9px 14px;
		border-radius: var(--radius-pill);
		background: var(--color-surface-elevated);
		color: var(--color-text-secondary);
		font-weight: var(--weight-medium);
		font-size: var(--text-sm);
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
		max-height: 46vh;
		overflow-y: auto;
	}
	.net {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		width: 100%;
		/* Big enough to hit reliably with a finger. */
		padding: 16px 18px;
		border-radius: var(--radius-md);
		background: var(--color-surface);
		box-shadow: var(--shadow-card);
		text-align: left;
		color: var(--color-text-secondary);
	}
	.net:active {
		background: var(--color-surface-elevated);
	}
	.sig {
		font-family: ui-monospace, monospace;
		letter-spacing: -1px;
		color: var(--color-text-tertiary);
	}
	.ssid {
		flex: 1;
		color: var(--color-text-primary);
	}
	.badge {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: var(--text-xs);
		padding: 3px 9px;
		border-radius: var(--radius-pill);
		background: color-mix(in srgb, var(--color-accent-success) 22%, var(--color-surface));
		color: #10391f;
	}
	.pwrow {
		display: flex;
		gap: var(--space-2);
	}
	.pw {
		flex: 1;
		padding: 14px 16px;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border-subtle);
		background: var(--color-surface);
		color: var(--color-text-primary);
		font-size: 1.2rem;
		letter-spacing: 2px;
	}
	.joinbtn {
		padding: 0 24px;
		border-radius: var(--radius-md);
		background: var(--color-text-primary);
		color: var(--color-surface);
		font-weight: var(--weight-semibold);
	}
	.joinbtn:disabled {
		opacity: 0.4;
	}
	.err {
		color: var(--color-accent-warning);
	}
</style>
