<script lang="ts">
	import { onMount } from 'svelte';
	import { Loader, X, Check } from 'lucide-svelte';

	let { profileId }: { profileId: number } = $props();

	let connected = $state(false);
	let accountEmail = $state<string | null>(null);
	let showingFlow = $state(false);
	let userCode = $state<string | null>(null);
	let verificationUrl = $state<string | null>(null);
	let deviceCode = $state<string | null>(null);
	let isPolling = $state(false);
	let error = $state<string | null>(null);

	// Load initial status
	onMount(async () => {
		try {
			const res = await fetch(`/api/google/status?profileId=${profileId}`);
			const data = await res.json();
			const conn = data.allConnections?.find((c: { profileId: number | null }) => c.profileId === profileId);
			if (conn?.accountEmail) {
				connected = true;
				accountEmail = conn.accountEmail;
			}
		} catch (e) {
			console.error('Failed to load Google status:', e);
		}
	});

	async function startConnect() {
		error = null;
		try {
			const res = await fetch(`/api/google/connect?profileId=${profileId}`, { method: 'POST' });
			if (!res.ok) throw new Error(await res.text());
			const { userCode: uc, verificationUrl: vu, deviceCode: dc, expiresIn } = await res.json();
			userCode = uc;
			verificationUrl = vu;
			deviceCode = dc;
			showingFlow = true;
			// Start polling after a short delay
			setTimeout(pollForToken, 1000);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to start Google sign-in';
		}
	}

	async function pollForToken() {
		if (!deviceCode || !isPolling) return;
		try {
			const res = await fetch('/api/google/poll', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ deviceCode, profileId })
			});
			const result = await res.json();

			if (result.status === 'granted') {
				connected = true;
				accountEmail = result.accountEmail || 'Connected';
				showingFlow = false;
				userCode = null;
				isPolling = false;
				return;
			}

			if (result.status === 'pending' || result.status === 'slow_down') {
				setTimeout(pollForToken, 3000);
				return;
			}

			// denied or expired
			error = result.error || 'Authorization failed';
			isPolling = false;
		} catch (e) {
			console.error('Poll error:', e);
			if (isPolling) setTimeout(pollForToken, 3000);
		}
	}

	function handleShowFlow() {
		if (!showingFlow) {
			startConnect();
		} else {
			isPolling = true;
			pollForToken();
		}
	}

	async function disconnect() {
		if (!confirm('Disconnect Google Calendar?')) return;
		try {
			await fetch(`/api/google/disconnect?profileId=${profileId}`, { method: 'POST' });
			connected = false;
			accountEmail = null;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to disconnect';
		}
	}
</script>

<div class="google-connect">
	{#if connected && accountEmail}
		<div class="connected">
			<div class="status">
				<Check size={16} />
				<span>Connected: {accountEmail}</span>
			</div>
			<button type="button" class="disconnect" onclick={disconnect} title="Disconnect Google Calendar">
				<X size={14} />
			</button>
		</div>
	{:else if showingFlow && userCode && verificationUrl}
		<div class="flow">
			<div class="instructions">
				<p>Sign in with your Google account:</p>
				<ol>
					<li>Visit: <a href={verificationUrl} target="_blank" rel="noopener">{verificationUrl}</a></li>
					<li>Enter code: <strong>{userCode}</strong></li>
					<li>Waiting for authorization...</li>
				</ol>
			</div>
			{#if error}
				<p class="error">{error}</p>
			{/if}
		</div>
	{:else}
		<button type="button" class="connect" onclick={handleShowFlow}>
			{#if isPolling}
				<Loader size={14} />
				Waiting...
			{:else}
				Connect Google Calendar
			{/if}
		</button>
		{#if error}
			<p class="error">{error}</p>
		{/if}
	{/if}
</div>

<style>
	.google-connect {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-border-subtle);
		background: var(--color-surface);
	}

	.connected {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		gap: 8px;
	}

	.status {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--color-text-secondary);
		font-size: var(--text-sm);
		flex: 1;
		min-width: 0;
	}

	.status :global(svg) {
		color: var(--color-success, #10b981);
		flex: none;
	}

	.disconnect {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border-radius: var(--radius-sm);
		background: var(--color-surface-elevated);
		color: var(--color-text-tertiary);
		border: none;
		cursor: pointer;
		flex: none;
	}

	.disconnect:hover {
		background: var(--color-surface-hover);
	}

	.connect {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px;
		border-radius: var(--radius-sm);
		border: none;
		background: var(--color-text-primary);
		color: var(--color-surface);
		font-size: var(--text-sm);
		font-weight: var(--weight-medium);
		cursor: pointer;
		width: 100%;
		justify-content: center;
	}

	.connect:hover {
		opacity: 0.9;
	}

	.connect :global(svg) {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.flow {
		width: 100%;
	}

	.instructions {
		font-size: var(--text-sm);
		color: var(--color-text-secondary);
	}

	.instructions p {
		margin: 0 0 8px 0;
		font-weight: var(--weight-medium);
		color: var(--color-text-primary);
	}

	.instructions ol {
		margin: 0;
		padding-left: 20px;
	}

	.instructions li {
		margin: 4px 0;
	}

	.instructions a {
		color: var(--color-accent);
		text-decoration: none;
	}

	.instructions a:hover {
		text-decoration: underline;
	}

	.error {
		margin-top: 8px;
		padding: 8px;
		border-radius: var(--radius-sm);
		background: rgba(255, 59, 48, 0.1);
		color: #ff3b30;
		font-size: var(--text-sm);
	}
</style>
