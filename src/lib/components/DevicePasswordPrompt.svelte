<script lang="ts">
	/**
	 * Asks for the device login password before a privileged action proceeds.
	 *
	 * Used by both the on-screen kiosk and the phone, because they render the
	 * same Settings page — a touchscreen gets the virtual keyboard, a phone
	 * uses its own. Call `request()`; it resolves true once the server has
	 * issued an elevated session, or false if the family backs out.
	 */
	import { family } from '$lib/stores/family.svelte';
	import OnScreenKeyboard from './OnScreenKeyboard.svelte';
	import { Lock } from 'lucide-svelte';

	let open = $state(false);
	let password = $state('');
	let busy = $state(false);
	let err = $state('');
	let resolver: ((ok: boolean) => void) | null = null;

	const needsOnScreenKeyboard = $derived(family.displayMode === 'touch');

	export function request(): Promise<boolean> {
		password = '';
		err = '';
		open = true;
		return new Promise<boolean>((resolve) => (resolver = resolve));
	}

	function settle(ok: boolean) {
		open = false;
		password = '';
		busy = false;
		resolver?.(ok);
		resolver = null;
	}

	async function submit() {
		if (!password || busy) return;
		busy = true;
		err = '';
		try {
			const r = await fetch('/api/device-auth', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ password })
			});
			if (r.ok) return settle(true);
			err =
				r.status === 429
					? 'Too many attempts. Wait a minute and try again.'
					: 'That password was not accepted.';
		} catch {
			err = 'Could not reach the device.';
		} finally {
			busy = false;
		}
	}
</script>

{#if open}
	<div class="backdrop" role="dialog" aria-modal="true" aria-label="Device password required">
		<div class="panel">
			<div class="head">
				<Lock size={22} />
				<h2 class="type-heading">Device password</h2>
			</div>
			<p class="type-body sub">
				This changes the device itself, so it needs the password you chose when setting up.
			</p>

			<input
				class="input"
				type="password"
				placeholder="Device password"
				readonly={needsOnScreenKeyboard}
				bind:value={password}
				onkeydown={(e) => e.key === 'Enter' && submit()}
			/>

			{#if needsOnScreenKeyboard}
				<OnScreenKeyboard bind:value={password} onenter={submit} />
			{/if}

			{#if err}<p class="type-caption err">{err}</p>{/if}

			<div class="row">
				<button type="button" class="btn" onclick={() => settle(false)}>Cancel</button>
				<button type="button" class="btn primary" disabled={!password || busy} onclick={submit}>
					{busy ? 'Checking…' : 'Continue'}
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
	.input {
		padding: 14px 16px;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border-subtle);
		background: var(--color-surface-elevated);
		color: var(--color-text-primary);
		font-size: var(--text-lg);
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
	.err {
		color: var(--color-accent-warning);
	}
</style>
