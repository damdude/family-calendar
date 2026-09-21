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
	import Spinner from './Spinner.svelte';
	import { Lock } from 'lucide-svelte';

	let open = $state(false);
	let password = $state('');
	let busy = $state(false);
	let err = $state('');
	let resolver: ((ok: boolean) => void) | null = null;

	// Recovery: prove presence by reading a code off the display, rather than
	// knowing the password. See $lib/server/recovery.
	let mode = $state<'password' | 'recovery'>('password');
	let recoveryCode = $state('');
	let recoveryErr = $state('');
	let recoveryBusy = $state(false);

	async function beginRecovery() {
		recoveryErr = '';
		recoveryCode = '';
		mode = 'recovery';
		try {
			await fetch('/api/recovery/start', { method: 'POST' });
		} catch {
			recoveryErr = 'Could not reach the device.';
		}
	}

	async function submitRecovery() {
		if (!recoveryCode || recoveryBusy) return;
		recoveryBusy = true;
		recoveryErr = '';
		try {
			const r = await fetch('/api/recovery/verify', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ code: recoveryCode })
			});
			const body = await r.json().catch(() => null);
			if (r.ok) {
				// The gate keys off devicePasswordSet, which the reset just
				// cleared, so replaying the original action now succeeds.
				return settle(true);
			}
			recoveryErr = body?.message ?? 'That code was not accepted.';
		} catch {
			recoveryErr = 'Could not reach the device.';
		} finally {
			recoveryBusy = false;
		}
	}

	const needsOnScreenKeyboard = $derived(family.displayMode === 'touch');

	export function request(): Promise<boolean> {
		password = '';
		err = '';
		mode = 'password';
		recoveryCode = '';
		recoveryErr = '';
		open = true;
		return new Promise<boolean>((resolve) => (resolver = resolve));
	}

	function settle(ok: boolean) {
		open = false;
		password = '';
		busy = false;
		mode = 'password';
		recoveryCode = '';
		recoveryErr = '';
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

			{#if mode === 'password'}
				<input
					class="input"
					type="password"
					autocapitalize="none"
					autocorrect="off"
					spellcheck="false"
					placeholder="Device password"
					readonly={needsOnScreenKeyboard}
					bind:value={password}
					onkeydown={(e) => e.key === 'Enter' && submit()}
				/>

				{#if needsOnScreenKeyboard}
					<OnScreenKeyboard bind:value={password} onenter={submit} />
				{/if}

				{#if err}<p class="type-caption err">{err}</p>{/if}

				<button type="button" class="linkbtn" onclick={beginRecovery}>
					Forgotten it? Recover using the screen
				</button>

				<div class="row">
					<button type="button" class="btn" onclick={() => settle(false)}>Cancel</button>
					<button type="button" class="btn primary" disabled={!password || busy} onclick={submit}>
						{#if busy}<Spinner size={14} />{/if}
						{busy ? 'Checking…' : 'Continue'}
					</button>
				</div>
			{:else}
				<p class="type-body sub">
					A four-digit code is now showing on the calendar screen. Read it from there and type it
					here. It is deliberately not available over the network — you have to be in front of the
					display.
				</p>

				<input
					class="input code"
					type="text"
					inputmode="numeric"
					autocapitalize="none"
					autocorrect="off"
					spellcheck="false"
					maxlength="4"
					placeholder="0000"
					readonly={needsOnScreenKeyboard}
					bind:value={recoveryCode}
					onkeydown={(e) => e.key === 'Enter' && submitRecovery()}
				/>

				{#if needsOnScreenKeyboard}
					<OnScreenKeyboard bind:value={recoveryCode} onenter={submitRecovery} />
				{/if}

				{#if recoveryErr}<p class="type-caption err">{recoveryErr}</p>{/if}

				<p class="type-caption sub">
					This resets the password to its factory default. Set a new one in Settings straight after.
				</p>

				<div class="row">
					<button type="button" class="btn" onclick={() => (mode = 'password')}>Back</button>
					<button
						type="button"
						class="btn primary"
						disabled={!recoveryCode || recoveryBusy}
						onclick={submitRecovery}
					>
						{#if recoveryBusy}<Spinner size={14} />{/if}
						{recoveryBusy ? 'Checking…' : 'Reset password'}
					</button>
				</div>
			{/if}
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
	.linkbtn {
		align-self: flex-start;
		background: none;
		padding: 0;
		color: var(--color-text-secondary);
		text-decoration: underline;
		font-size: var(--text-sm);
	}
	.code {
		text-align: center;
		font-size: 2rem;
		letter-spacing: 0.4em;
		font-variant-numeric: tabular-nums;
	}
</style>
