<script lang="ts">
	import { family } from '$lib/stores/family.svelte';
	import { admin } from '$lib/stores/admin.svelte';
	import type { FeatureFlags } from '$lib/config';
	import ProfileEditor from '$lib/components/ProfileEditor.svelte';
	import GoogleConnect from '$lib/components/GoogleConnect.svelte';
	import PinPad from '$lib/components/PinPad.svelte';
	import { QrCode, Check, RefreshCw } from 'lucide-svelte';

	// Parental lock.
	let pinSet = $state(false);
	$effect(() => {
		fetch('/api/pin')
			.then((r) => (r.ok ? r.json() : null))
			.then((v) => (pinSet = v?.pinSet ?? false))
			.catch(() => {});
	});
	const locked = $derived(family.config.kiosk.parentalLock && pinSet && !admin.unlocked);

	async function tryUnlock(pin: string): Promise<boolean> {
		const r = await fetch('/api/pin/verify', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ pin })
		});
		const ok = r.ok && (await r.json()).ok;
		if (ok) admin.unlocked = true;
		return ok;
	}

	// PIN setup form.
	let showPinForm = $state(false);
	let newPin = $state('');
	let currentPin = $state('');
	let pinMsg = $state('');
	async function savePin() {
		pinMsg = '';
		const r = await fetch('/api/pin', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ pin: newPin, current: currentPin || undefined })
		});
		if (r.ok) {
			pinSet = true;
			admin.unlocked = true;
			showPinForm = false;
			newPin = '';
			currentPin = '';
			pinMsg = 'PIN saved.';
		} else {
			pinMsg = (await r.json().catch(() => ({})))?.message ?? 'Could not save PIN.';
		}
	}
	function toggleParentalLock() {
		if (!family.config.kiosk.parentalLock && !pinSet) {
			// Must set a PIN before enabling.
			showPinForm = true;
			pinMsg = 'Set a PIN first to enable the lock.';
			return;
		}
		family.config.kiosk.parentalLock = !family.config.kiosk.parentalLock;
		persist();
	}

	// Update status.
	let version = $state<{ commit: string; dirty: boolean } | null>(null);
	let checking = $state(false);
	let checkMsg = $state('');
	$effect(() => {
		fetch('/api/update')
			.then((r) => (r.ok ? r.json() : null))
			.then((v) => (version = v))
			.catch(() => {});
	});
	async function checkUpdates() {
		checking = true;
		checkMsg = '';
		try {
			const r = await fetch('/api/update', { method: 'POST' });
			checkMsg = r.ok ? 'Checking for updates…' : 'Could not start update check.';
		} finally {
			checking = false;
		}
	}

	// Persist store snapshot to config.json (debounced) on any change.
	let saveTimer: ReturnType<typeof setTimeout>;
	let savedFlash = $state(false);
	function persist() {
		clearTimeout(saveTimer);
		saveTimer = setTimeout(async () => {
			try {
				await fetch('/api/config', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(family.toPersisted())
				});
				savedFlash = true;
				setTimeout(() => (savedFlash = false), 1400);
			} catch {
				/* offline; will re-save on next change */
			}
		}, 400);
	}

	const featureLabels: Record<keyof FeatureFlags, string> = {
		calendar: 'Calendar',
		lists: 'Lists',
		tasks: 'Tasks',
		rewards: 'Rewards',
		meals: 'Meal planning',
		recipes: 'Recipes',
		photos: 'Photos',
		sleep: 'Sleep mode',
		routines: 'Kid routines',
		feelings: "Today's Feelings",
		sitesOfInterest: 'Sites of Interest'
	};
	const featureKeys = Object.keys(featureLabels) as (keyof FeatureFlags)[];

	function toggleFeature(k: keyof FeatureFlags) {
		family.config.features[k] = !family.config.features[k];
		persist();
	}
</script>

<div class="settings">
	<div class="pagehead">
		<h1 class="type-title">Settings</h1>
		<span class="saved" class:on={savedFlash}><Check size={14} /> Saved</span>
	</div>

	{#if locked}
		<PinPad title="Settings locked" subtitle="Enter the parental PIN" onComplete={tryUnlock} />
	{:else}
		<!-- Orientation -->
		<section class="card">
			<div class="cardhead">
				<h2 class="type-heading">Display orientation</h2>
				<p class="type-caption sub">Match how your screen is mounted.</p>
			</div>
			<div class="orient">
				{#each [{ v: 'landscape', label: 'Landscape' }, { v: 'portrait', label: 'Portrait' }] as opt (opt.v)}
					<button
						type="button"
						class="orientbtn pressable"
						class:on={family.config.view.orientation === opt.v}
						onclick={() => {
							family.config.view.orientation = opt.v as 'landscape' | 'portrait';
							persist();
						}}
					>
						<span class="frame {opt.v}"></span>
						<span class="type-label">{opt.label}</span>
					</button>
				{/each}
			</div>
		</section>

		<!-- Family -->
		<section class="card">
			<div class="cardhead"><h2 class="type-heading">Family</h2></div>
			<label class="field">
				<span class="type-label lbl">Family name</span>
				<input
					class="input"
					type="text"
					bind:value={family.data.familyName}
					oninput={persist}
					maxlength="60"
				/>
			</label>
			<div class="field">
				<span class="type-label lbl">People</span>
				<p class="type-caption sub">
					Tap a photo to upload one. Photos are encrypted on the device.
				</p>
				<ProfileEditor onChange={persist} />
			</div>
		</section>

		<!-- Display prefs -->
		<section class="card">
			<div class="cardhead"><h2 class="type-heading">Display</h2></div>
			<div class="rowset">
				<div class="row">
					<span class="type-label">Clock</span>
					<div class="segmented">
						<button
							type="button"
							class="seg"
							class:on={!family.config.view.clock24h}
							onclick={() => {
								family.config.view.clock24h = false;
								persist();
							}}>12-hour</button
						>
						<button
							type="button"
							class="seg"
							class:on={family.config.view.clock24h}
							onclick={() => {
								family.config.view.clock24h = true;
								persist();
							}}>24-hour</button
						>
					</div>
				</div>
				<div class="row">
					<span class="type-label">Week starts on</span>
					<div class="segmented">
						<button
							type="button"
							class="seg"
							class:on={family.config.view.weekStartsOn === 1}
							onclick={() => {
								family.config.view.weekStartsOn = 1;
								persist();
							}}>Monday</button
						>
						<button
							type="button"
							class="seg"
							class:on={family.config.view.weekStartsOn === 0}
							onclick={() => {
								family.config.view.weekStartsOn = 0;
								persist();
							}}>Sunday</button
						>
					</div>
				</div>
				<div class="row">
					<span class="type-label">Celebrations</span>
					<button
						type="button"
						class="switch"
						class:on={family.config.celebrations}
						role="switch"
						aria-checked={family.config.celebrations}
						aria-label="Celebrations"
						onclick={() => {
							family.config.celebrations = !family.config.celebrations;
							persist();
						}}
					>
						<span class="knob"></span>
					</button>
				</div>
				<div class="row">
					<span class="type-label"
						>Read-only display <span class="hint type-caption">edits from a phone only</span></span
					>
					<button
						type="button"
						class="switch"
						class:on={family.config.kiosk.readOnly}
						role="switch"
						aria-checked={family.config.kiosk.readOnly}
						aria-label="Read-only display"
						onclick={() => {
							family.config.kiosk.readOnly = !family.config.kiosk.readOnly;
							persist();
						}}
					>
						<span class="knob"></span>
					</button>
				</div>
			</div>
		</section>

		<!-- Screensaver & sleep -->
		<section class="card">
			<div class="cardhead">
				<h2 class="type-heading">Screensaver &amp; sleep</h2>
			</div>
			<div class="rowset">
				<div class="row">
					<span class="type-label">Screensaver</span>
					<button
						type="button"
						class="switch"
						class:on={family.config.screensaver.enabled}
						role="switch"
						aria-checked={family.config.screensaver.enabled}
						aria-label="Screensaver"
						onclick={() => {
							family.config.screensaver.enabled = !family.config.screensaver.enabled;
							persist();
						}}
					>
						<span class="knob"></span>
					</button>
				</div>
				<div class="row">
					<span class="type-label">Mode</span>
					<div class="segmented">
						<button
							type="button"
							class="seg"
							class:on={family.config.screensaver.mode === 'clock'}
							onclick={() => {
								family.config.screensaver.mode = 'clock';
								persist();
							}}>Clock</button
						>
						<button
							type="button"
							class="seg"
							class:on={family.config.screensaver.mode === 'photos'}
							onclick={() => {
								family.config.screensaver.mode = 'photos';
								persist();
							}}>Photos</button
						>
					</div>
				</div>
				<div class="row">
					<span class="type-label">Show after idle</span>
					<div class="segmented">
						{#each [0, 5, 10, 30] as m (m)}
							<button
								type="button"
								class="seg"
								class:on={family.config.screensaver.idleMinutes === m}
								onclick={() => {
									family.config.screensaver.idleMinutes = m;
									persist();
								}}>{m === 0 ? 'Off' : m + 'm'}</button
							>
						{/each}
					</div>
				</div>
				<div class="row">
					<span class="type-label"
						>Sleep window <span class="hint type-caption">screensaver stays on</span></span
					>
					<button
						type="button"
						class="switch"
						class:on={family.config.sleep.enabled}
						role="switch"
						aria-checked={family.config.sleep.enabled}
						aria-label="Sleep window"
						onclick={() => {
							family.config.sleep.enabled = !family.config.sleep.enabled;
							persist();
						}}
					>
						<span class="knob"></span>
					</button>
				</div>
				{#if family.config.sleep.enabled}
					<div class="row">
						<span class="type-label">From — to</span>
						<div class="times">
							<input
								class="timeinput"
								type="time"
								bind:value={family.config.sleep.start}
								onchange={persist}
							/>
							<span class="dash">–</span>
							<input
								class="timeinput"
								type="time"
								bind:value={family.config.sleep.end}
								onchange={persist}
							/>
						</div>
					</div>
				{/if}
			</div>
		</section>

		<!-- Features -->
		<section class="card">
			<div class="cardhead">
				<h2 class="type-heading">Features</h2>
				<p class="type-caption sub">Turn a feature off to hide its tab entirely.</p>
			</div>
			<div class="rowset">
				{#each featureKeys as k (k)}
					<div class="row">
						<span class="type-label">{featureLabels[k]}</span>
						<button
							type="button"
							class="switch"
							class:on={family.config.features[k]}
							role="switch"
							aria-checked={family.config.features[k]}
							aria-label={featureLabels[k]}
							onclick={() => toggleFeature(k)}
						>
							<span class="knob"></span>
						</button>
					</div>
				{/each}
			</div>
		</section>

		<!-- Calendar accounts -->
		<section class="card">
			<div class="cardhead">
				<h2 class="type-heading">Calendar accounts</h2>
				<p class="type-caption sub">Sync events from Google Calendar.</p>
			</div>
			<GoogleConnect />
		</section>

		<!-- Software updates -->
		<section class="card">
			<div class="cardhead"><h2 class="type-heading">Software updates</h2></div>
			<div class="rowset">
				<div class="row">
					<span class="type-label"
						>Version <span class="hint type-caption"
							>{version ? version.commit + (version.dirty ? ' (modified)' : '') : '…'}</span
						></span
					>
					<button type="button" class="pairbtn small" disabled={checking} onclick={checkUpdates}>
						<RefreshCw size={15} /> Check now
					</button>
				</div>
				<div class="row">
					<span class="type-label"
						>Automatic updates <span class="hint type-caption"
							>every {family.config.updates.intervalHours}h</span
						></span
					>
					<button
						type="button"
						class="switch"
						class:on={!family.config.updates.paused}
						role="switch"
						aria-checked={!family.config.updates.paused}
						aria-label="Automatic updates"
						onclick={() => {
							family.config.updates.paused = !family.config.updates.paused;
							persist();
						}}
					>
						<span class="knob"></span>
					</button>
				</div>
				{#if checkMsg}<p class="type-caption hint">{checkMsg}</p>{/if}
			</div>
		</section>

		<!-- Parental lock -->
		<section class="card">
			<div class="cardhead">
				<h2 class="type-heading">Parental lock</h2>
				<p class="type-caption sub">Require a PIN to open Settings.</p>
			</div>
			<div class="rowset">
				<div class="row">
					<span class="type-label"
						>Lock Settings <span class="hint type-caption"
							>{pinSet ? 'PIN is set' : 'no PIN yet'}</span
						></span
					>
					<button
						type="button"
						class="switch"
						class:on={family.config.kiosk.parentalLock}
						role="switch"
						aria-checked={family.config.kiosk.parentalLock}
						aria-label="Lock Settings"
						onclick={toggleParentalLock}
					>
						<span class="knob"></span>
					</button>
				</div>
				<div class="row">
					<span class="type-label">{pinSet ? 'Change PIN' : 'Set a PIN'}</span>
					<button type="button" class="pairbtn small" onclick={() => (showPinForm = !showPinForm)}
						>{showPinForm ? 'Cancel' : pinSet ? 'Change' : 'Set PIN'}</button
					>
				</div>
				{#if showPinForm}
					<div class="pinform">
						{#if pinSet}
							<input
								class="input"
								type="password"
								inputmode="numeric"
								placeholder="Current PIN"
								bind:value={currentPin}
							/>
						{/if}
						<input
							class="input"
							type="password"
							inputmode="numeric"
							placeholder="New PIN (4–8 digits)"
							bind:value={newPin}
						/>
						<button type="button" class="pairbtn" onclick={savePin}>Save PIN</button>
					</div>
				{/if}
				{#if pinMsg}<p class="type-caption hint">{pinMsg}</p>{/if}
			</div>
		</section>

		<!-- Pairing -->
		<section class="card">
			<div class="cardhead"><h2 class="type-heading">Pair a phone</h2></div>
			<p class="type-body sub">Open the setup wizard to reconfigure from your phone.</p>
			<a class="pairbtn pressable" href="/setup"><QrCode size={18} /> Show pairing code</a>
		</section>
	{/if}
</div>

<style>
	.settings {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding-top: var(--space-2);
		max-width: 720px;
	}
	.pagehead {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.saved {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: var(--color-accent-success);
		opacity: 0;
		transition: opacity var(--dur-quick) var(--ease-out);
		font-size: var(--text-sm);
		font-weight: var(--weight-semibold);
	}
	.saved.on {
		opacity: 1;
	}
	.card {
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-card);
		padding: var(--space-5);
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	.cardhead {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.sub {
		color: var(--color-text-tertiary);
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.lbl {
		color: var(--color-text-secondary);
	}
	.hint {
		display: block;
		color: var(--color-text-tertiary);
		font-weight: var(--weight-regular);
	}
	.pinform {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: center;
		padding-top: var(--space-2);
	}
	.pinform .input {
		flex: 1;
		min-width: 140px;
	}
	.times {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}
	.timeinput {
		padding: 6px 10px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-border-subtle);
		background: var(--color-surface);
		color: var(--color-text-primary);
		font-variant-numeric: tabular-nums;
	}
	.dash {
		color: var(--color-text-tertiary);
	}
	.input {
		width: 100%;
		padding: 12px 14px;
		font-size: var(--text-lg);
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border-subtle);
		background: var(--color-surface);
		color: var(--color-text-primary);
	}

	/* Orientation picker */
	.orient {
		display: flex;
		gap: var(--space-3);
	}
	.orientbtn {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-4);
		border-radius: var(--radius-md);
		background: var(--color-surface-elevated);
		flex: 1;
		max-width: 160px;
	}
	.orientbtn.on {
		background: var(--color-surface);
		box-shadow: 0 0 0 2px var(--color-text-primary);
	}
	.frame {
		border: 2px solid var(--color-text-secondary);
		border-radius: 4px;
		background: color-mix(in srgb, var(--color-profile-blue) 30%, white);
	}
	.frame.landscape {
		width: 72px;
		height: 46px;
	}
	.frame.portrait {
		width: 46px;
		height: 72px;
	}

	/* Rows + switches */
	.rowset {
		display: flex;
		flex-direction: column;
	}
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 0;
		border-bottom: 1px solid var(--color-border-hairline);
	}
	.row:last-child {
		border-bottom: none;
	}
	.segmented {
		display: flex;
		gap: 4px;
		padding: 3px;
		background: var(--color-surface-elevated);
		border-radius: var(--radius-pill);
	}
	.seg {
		padding: 6px 14px;
		border-radius: var(--radius-pill);
		font-weight: var(--weight-medium);
		color: var(--color-text-secondary);
		font-size: var(--text-sm);
	}
	.seg.on {
		background: var(--color-surface);
		color: var(--color-text-primary);
		box-shadow: var(--shadow-card);
	}
	.switch {
		width: 48px;
		height: 28px;
		border-radius: var(--radius-pill);
		background: var(--color-border-subtle);
		padding: 3px;
		display: flex;
		transition: background var(--dur-quick) var(--ease-out);
	}
	.switch.on {
		background: var(--color-accent-success);
		justify-content: flex-end;
	}
	.knob {
		width: 22px;
		height: 22px;
		border-radius: var(--radius-pill);
		background: white;
		box-shadow: var(--shadow-card);
	}
	.pairbtn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		align-self: flex-start;
		padding: 12px 18px;
		border-radius: var(--radius-pill);
		background: var(--color-text-primary);
		color: var(--color-surface);
		font-weight: var(--weight-semibold);
	}
	.pairbtn.small {
		padding: 7px 14px;
		gap: 6px;
		font-size: var(--text-sm);
	}
	.pairbtn:disabled {
		opacity: 0.5;
	}
</style>
