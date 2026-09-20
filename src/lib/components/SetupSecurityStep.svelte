<script lang="ts">
	/**
	 * Final setup step, shared by BOTH wizards (the on-screen touch flow and
	 * the phone flow). Deliberately one component rather than a copy in each:
	 * the two wizards previously drifted apart, and a step that sets a device
	 * password is exactly the kind of thing that must not exist in only one.
	 *
	 * Both fields are optional — a family with no Google account, or one happy
	 * with the default password, can walk straight past this.
	 */
	let pw = $state('');
	let pw2 = $state('');
	let clientId = $state('');
	let clientSecret = $state('');

	let saving = $state(false);
	let savedPw = $state(false);
	let savedGoogle = $state(false);
	let err = $state('');

	export async function save(): Promise<boolean> {
		err = '';
		saving = true;
		try {
			if (pw || pw2) {
				if (pw !== pw2) throw new Error('The passwords do not match.');
				if (pw.length < 6) throw new Error('Use at least 6 characters.');
				const r = await fetch('/api/pi-password', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ newPassword: pw, confirmPassword: pw2 })
				});
				if (!r.ok) throw new Error('Could not change the device password.');
				savedPw = true;
			}
			if (clientId || clientSecret) {
				const r = await fetch('/api/setup-env', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ googleClientId: clientId, googleClientSecret: clientSecret })
				});
				if (!r.ok) {
					const msg = await r.text().catch(() => '');
					throw new Error(msg || 'Could not save the Google credentials.');
				}
				savedGoogle = true;
			}
			return true;
		} catch (e) {
			err = e instanceof Error ? e.message : 'Something went wrong.';
			return false;
		} finally {
			saving = false;
		}
	}
</script>

<h1 class="type-title">Device &amp; accounts</h1>
<p class="type-body sub">Both of these are optional — you can skip straight past them.</p>

<div class="grp">
	<h2 class="type-label grp-h">Device password</h2>
	<p class="type-caption sub">Replaces the default password used to sign in to this device.</p>
	<label class="field">
		<span class="type-label">New password</span>
		<input class="input" type="password" bind:value={pw} maxlength="64" placeholder="Leave blank to keep the current one" />
	</label>
	<label class="field">
		<span class="type-label">Confirm password</span>
		<input class="input" type="password" bind:value={pw2} maxlength="64" placeholder="Repeat it" />
	</label>
	{#if savedPw}<p class="type-caption ok">Password updated.</p>{/if}
</div>

<div class="grp">
	<h2 class="type-label grp-h">Google Calendar</h2>
	<p class="type-caption sub">
		Paste the OAuth client for this device (a “TVs and Limited Input” client from the Google Cloud
		console). Each person connects their own Google account afterwards, from Settings.
	</p>
	<label class="field">
		<span class="type-label">Client ID</span>
		<input class="input" type="text" bind:value={clientId} placeholder="…apps.googleusercontent.com" />
	</label>
	<label class="field">
		<span class="type-label">Client secret</span>
		<input class="input" type="password" bind:value={clientSecret} placeholder="Leave blank to set this up later" />
	</label>
	{#if savedGoogle}<p class="type-caption ok">Google credentials saved.</p>{/if}
	<p class="type-caption sub">Stored only on this device, never in the project's source.</p>
</div>

{#if err}<p class="type-label err">{err}</p>{/if}
{#if saving}<p class="type-caption sub">Saving…</p>{/if}

<style>
	.sub {
		color: var(--color-text-secondary);
	}
	.grp {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-3) 0;
		border-top: 1px solid var(--color-border-hairline);
	}
	.grp-h {
		color: var(--color-text-primary);
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.input {
		padding: 12px 14px;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border-subtle);
		background: var(--color-surface);
		color: var(--color-text-primary);
		font-size: var(--text-lg);
		width: 100%;
	}
	.ok {
		color: var(--color-accent-success);
	}
	.err {
		color: var(--color-accent-warning);
	}
</style>
