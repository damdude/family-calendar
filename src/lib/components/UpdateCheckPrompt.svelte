<script lang="ts">
	/**
	 * First-run setup: the moment the device comes online, kick an update
	 * check and, if one is actually available, ask whether to install it now
	 * or keep setting up. Deliberately separate from UpdateOverlay (mounted
	 * globally in the root layout) — that one shows install PROGRESS once an
	 * install has started, driven by the same /api/update polling, and picks
	 * this one's install up automatically with no coordination needed here.
	 *
	 * Checking (and the install trigger) needs its own setup-time auth
	 * (api/update/install-setup) rather than the usual device-password gate:
	 * nobody has chosen a password yet at this point in the wizard.
	 */
	import { Sparkles } from 'lucide-svelte';

	let { token, online }: { token: string; online: boolean } = $props();

	interface UpdateState {
		status: 'idle' | 'available' | 'installing' | 'failed';
		notes?: string[];
	}

	let update = $state<UpdateState | null>(null);
	let dismissed = $state(false);
	let checkTriggered = $state(false);
	let installing = $state(false);
	let pollTimer: ReturnType<typeof setInterval>;

	async function poll() {
		try {
			const r = await fetch('/api/update');
			if (r.ok) update = (await r.json()).update ?? null;
		} catch {
			/* transient — next tick retries */
		}
	}

	$effect(() => {
		if (!online) return;
		poll();
		pollTimer = setInterval(poll, 3000);
		return () => clearInterval(pollTimer);
	});

	// Kick a check exactly once per setup session, the first time we're
	// online — not on every reconnect, so a flaky Wi-Fi join during the
	// earlier step can't restart it over and over.
	$effect(() => {
		if (!online || checkTriggered) return;
		checkTriggered = true;
		fetch('/api/update', { method: 'POST' }).catch(() => {});
	});

	const show = $derived(!dismissed && !installing && update?.status === 'available');

	async function installNow() {
		installing = true;
		try {
			await fetch('/api/update/install-setup', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ token })
			});
			// UpdateOverlay takes it from here.
		} catch {
			installing = false;
		}
	}
</script>

{#if show}
	<div class="backdrop" role="dialog" aria-modal="true" aria-label="Update available">
		<div class="panel">
			<div class="head">
				<Sparkles size={22} />
				<h2 class="type-heading">Update available</h2>
			</div>
			<p class="type-body sub">A newer version of Family Calendar is ready to install.</p>
			{#if update?.notes?.length}
				<ul class="notes">
					{#each update.notes as n (n)}<li class="type-caption">{n}</li>{/each}
				</ul>
			{/if}
			<p class="type-caption sub">
				Installing now takes a couple of minutes and restarts the display, then picks setup back up
				right where you left it. You can also keep going and install it later from Settings.
			</p>
			<div class="row">
				<button type="button" class="btn" onclick={() => (dismissed = true)}>
					Continue setting up
				</button>
				<button type="button" class="btn primary" disabled={installing} onclick={installNow}>
					{installing ? 'Starting…' : 'Install now'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 60;
		display: grid;
		place-items: center;
		padding: var(--space-4);
		background: rgba(0, 0, 0, 0.55);
	}
	.panel {
		width: min(460px, 100%);
		max-height: 90vh;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-5);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		box-shadow: var(--shadow-card);
	}
	.head {
		display: flex;
		align-items: center;
		gap: 10px;
		color: var(--color-text-primary);
	}
	.sub {
		color: var(--color-text-secondary);
	}
	.notes {
		margin: 0;
		padding-left: var(--space-4);
		color: var(--color-text-secondary);
	}
	.row {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-2);
	}
	.btn {
		padding: 11px 20px;
		border-radius: var(--radius-md);
		background: var(--color-surface-elevated);
		color: var(--color-text-primary);
		font-weight: var(--weight-semibold);
	}
	.btn.primary {
		background: var(--color-text-primary);
		color: var(--color-surface);
	}
	.btn:disabled {
		opacity: 0.45;
	}
</style>
