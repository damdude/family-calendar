<script lang="ts">
	/**
	 * Edit the device-level Google OAuth client after setup.
	 *
	 * Until this existed the only way to correct a mistyped client was a
	 * factory reset, because Settings merely printed instructions to edit
	 * .env by hand — which needs SSH, which the family does not have.
	 *
	 * The inputs disable autocapitalise/autocorrect deliberately: iOS rewrites
	 * long alphanumeric tokens as they are typed, which produced a client ID
	 * Google reported as "not found" while looking correct on screen.
	 */
	import DevicePasswordPrompt from './DevicePasswordPrompt.svelte';
	import Spinner from './Spinner.svelte';

	let { onsaved }: { onsaved?: () => void } = $props();

	let clientId = $state('');
	let clientSecret = $state('');
	let saving = $state(false);
	let msg = $state('');
	let err = $state('');
	let pwPrompt = $state<DevicePasswordPrompt | null>(null);

	async function save() {
		err = '';
		msg = '';
		if (!clientId.trim() || !clientSecret.trim()) {
			err = 'Both the client ID and the client secret are required.';
			return;
		}
		saving = true;
		try {
			const send = () =>
				fetch('/api/setup-env', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						googleClientId: clientId.trim(),
						googleClientSecret: clientSecret.trim()
					})
				});
			let r = await send();
			if (r.status === 401) {
				const body = await r
					.clone()
					.json()
					.catch(() => null);
				if (body?.needsDevicePassword && (await pwPrompt?.request())) r = await send();
			}
			if (!r.ok) {
				const body = await r.json().catch(() => null);
				throw new Error(body?.message || 'Could not save the credentials.');
			}
			msg = 'Saved. Each person can now connect their Google account.';
			clientId = '';
			clientSecret = '';
			onsaved?.();
		} catch (e) {
			err = e instanceof Error ? e.message : 'Could not save the credentials.';
		} finally {
			saving = false;
		}
	}
</script>

<DevicePasswordPrompt bind:this={pwPrompt} />

<div class="creds">
	<p class="type-caption sub">
		Paste the OAuth client for this device — a “TVs and Limited Input devices” client from the
		Google Cloud console. Stored only on this device.
	</p>
	<label class="field">
		<span class="type-label">Client ID</span>
		<input
			class="in"
			type="text"
			autocapitalize="none"
			autocorrect="off"
			spellcheck="false"
			placeholder="…apps.googleusercontent.com"
			bind:value={clientId}
		/>
	</label>
	<label class="field">
		<span class="type-label">Client secret</span>
		<input
			class="in"
			type="password"
			autocapitalize="none"
			autocorrect="off"
			spellcheck="false"
			bind:value={clientSecret}
		/>
	</label>
	<button type="button" class="save" disabled={saving} onclick={save}>
		{#if saving}<Spinner size={14} />{/if}
		{saving ? 'Saving…' : 'Save credentials'}
	</button>
	{#if msg}<p class="type-caption ok">{msg}</p>{/if}
	{#if err}<p class="type-caption err">{err}</p>{/if}
</div>

<style>
	.creds {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.sub {
		color: var(--color-text-secondary);
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.in {
		padding: 10px 12px;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border-subtle);
		background: var(--color-surface);
		color: var(--color-text-primary);
		font-size: var(--text-sm);
	}
	.save {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 9px 16px;
		border-radius: var(--radius-md);
		background: var(--color-text-primary);
		color: var(--color-surface);
		font-weight: var(--weight-semibold);
	}
	.save:disabled {
		opacity: 0.5;
	}
	.ok {
		color: var(--color-accent-success);
	}
	.err {
		color: var(--color-accent-warning);
	}
</style>
