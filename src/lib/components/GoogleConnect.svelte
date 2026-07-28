<script lang="ts">
	import { RefreshCw, Link2, Link2Off } from 'lucide-svelte';

	type Status = { configured: boolean; connected: boolean; account: string | null };

	let status = $state<Status | null>(null);
	let userCode = $state<string | null>(null);
	let verificationUrl = $state<string | null>(null);
	let polling = $state(false);
	let message = $state('');
	let syncing = $state(false);

	async function loadStatus() {
		const res = await fetch('/api/google/status');
		if (res.ok) status = await res.json();
	}
	let pollTimer: ReturnType<typeof setTimeout>;
	$effect(() => {
		loadStatus();
		return () => clearTimeout(pollTimer);
	});

	async function connect() {
		message = '';
		const res = await fetch('/api/google/connect', { method: 'POST' });
		if (!res.ok) {
			message = (await res.json().catch(() => ({})))?.message ?? 'Could not start sign-in.';
			return;
		}
		const dc = await res.json();
		userCode = dc.userCode;
		verificationUrl = dc.verificationUrl;
		polling = true;
		poll(dc.deviceCode, (dc.interval ?? 5) * 1000);
	}

	async function poll(deviceCode: string, intervalMs: number) {
		const res = await fetch('/api/google/poll', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ deviceCode })
		});
		const r = await res.json().catch(() => ({ status: 'expired' }));
		if (r.status === 'granted') {
			polling = false;
			userCode = null;
			message = `Connected! Synced ${r.synced ?? 0} events.`;
			await loadStatus();
			return;
		}
		if (r.status === 'denied' || r.status === 'expired') {
			polling = false;
			userCode = null;
			message = 'Sign-in was not completed. Try again.';
			return;
		}
		const next = r.status === 'slow_down' ? intervalMs + 5000 : intervalMs;
		pollTimer = setTimeout(() => poll(deviceCode, next), next);
	}

	async function syncNow() {
		syncing = true;
		message = '';
		try {
			const res = await fetch('/api/google/sync', { method: 'POST' });
			const r = await res.json().catch(() => ({}));
			message = res.ok ? `Synced ${r.count} events.` : (r.message ?? 'Sync failed.');
		} finally {
			syncing = false;
		}
	}

	async function disconnect() {
		await fetch('/api/google/disconnect', { method: 'POST' });
		message = '';
		await loadStatus();
	}
</script>

<div class="gc">
	{#if !status}
		<p class="type-body sub">Checking…</p>
	{:else if !status.configured}
		<p class="type-body sub">
			Google Calendar isn't configured on this device yet. Add
			<code>GOOGLE_OAUTH_CLIENT_ID</code> and <code>GOOGLE_OAUTH_CLIENT_SECRET</code> to
			<code>.env</code> (a "TVs and Limited Input" OAuth client), then restart.
		</p>
	{:else if status.connected}
		<div class="connected">
			<span class="badge ok"
				><Link2 size={16} /> Connected{status.account ? ` · ${status.account}` : ''}</span
			>
			<div class="actions">
				<button type="button" class="btn" disabled={syncing} onclick={syncNow}>
					<RefreshCw size={16} />
					{syncing ? 'Syncing…' : 'Sync now'}
				</button>
				<button type="button" class="btn ghost" onclick={disconnect}>
					<Link2Off size={16} /> Disconnect
				</button>
			</div>
		</div>
	{:else if polling && userCode}
		<div class="pairing">
			<p class="type-body">
				On another device, go to <strong>{verificationUrl}</strong> and enter:
			</p>
			<div class="code">{userCode}</div>
			<p class="type-caption sub">Waiting for you to approve…</p>
		</div>
	{:else}
		<button type="button" class="btn primary" onclick={connect}
			><Link2 size={16} /> Connect Google Calendar</button
		>
	{/if}

	{#if message}<p class="type-caption msg">{message}</p>{/if}
</div>

<style>
	.gc {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.sub {
		color: var(--color-text-secondary);
	}
	code {
		font-family: ui-monospace, monospace;
		font-size: 0.85em;
		background: var(--color-surface-elevated);
		padding: 1px 5px;
		border-radius: 5px;
	}
	.connected {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		flex-wrap: wrap;
	}
	.badge {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-weight: var(--weight-semibold);
	}
	.badge.ok {
		color: var(--color-accent-success);
	}
	.actions {
		display: flex;
		gap: var(--space-2);
	}
	.btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 9px 14px;
		border-radius: var(--radius-pill);
		background: var(--color-surface-elevated);
		color: var(--color-text-primary);
		font-weight: var(--weight-semibold);
		font-size: var(--text-sm);
	}
	.btn.primary {
		background: var(--color-text-primary);
		color: var(--color-surface);
	}
	.btn.ghost {
		background: transparent;
		box-shadow: inset 0 0 0 1px var(--color-border-subtle);
	}
	.btn:disabled {
		opacity: 0.5;
	}
	.pairing {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		align-items: flex-start;
	}
	.code {
		font-family: ui-monospace, monospace;
		font-size: var(--text-3xl);
		font-weight: var(--weight-bold);
		letter-spacing: 0.1em;
		padding: 8px 16px;
		border-radius: var(--radius-md);
		background: var(--color-surface-elevated);
	}
	.msg {
		color: var(--color-text-secondary);
	}
</style>
