<script lang="ts">
	import { family } from '$lib/stores/family.svelte';
	import { admin } from '$lib/stores/admin.svelte';
	import { routinesOn } from '$lib/types';
	import type { FeatureFlags } from '$lib/config';
	import ProfileEditor from '$lib/components/ProfileEditor.svelte';
	import GoogleConnect from '$lib/components/GoogleConnect.svelte';
	import CalendarLinks from '$lib/components/CalendarLinks.svelte';
	import StoragePanel from '$lib/components/StoragePanel.svelte';
	import PinPad from '$lib/components/PinPad.svelte';
	import WifiPicker from '$lib/components/WifiPicker.svelte';
	import { QrCode, Check, RefreshCw, Wifi } from 'lucide-svelte';

	// Wi-Fi status + "change network" panel.
	let wifiStatus = $state<{ online: boolean; ssid: string | null; signal: number | null } | null>(
		null
	);
	let changingWifi = $state(false);
	async function loadWifiStatus() {
		try {
			const r = await fetch('/api/net/status');
			if (r.ok) wifiStatus = await r.json();
		} catch {
			/* keep last known state */
		}
	}
	$effect(() => {
		loadWifiStatus();
		const id = setInterval(loadWifiStatus, 15000);
		return () => clearInterval(id);
	});

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

	// --- Update status (two-step: check, then an explicit install) ---
	interface UpdateState {
		status: 'idle' | 'available' | 'installing' | 'failed';
		currentCommit?: string;
		targetCommit?: string;
		notes?: string[];
		error?: string;
		progress?: number;
	}
	let version = $state<{ commit: string; dirty: boolean; update: UpdateState | null } | null>(
		null
	);
	let checking = $state(false);
	let installing = $state(false);
	let pollTimer: ReturnType<typeof setInterval>;

	async function loadVersion() {
		try {
			const r = await fetch('/api/update');
			if (r.ok) version = await r.json();
		} catch {
			/* offline; next poll retries */
		}
	}
	$effect(() => {
		loadVersion();
		// Keep polling always (not just while installing) — a weekly automatic
		// check can flip status to "available" in the background with no one
		// having clicked anything, and this is how that gets noticed.
		pollTimer = setInterval(loadVersion, 5000);
		return () => clearInterval(pollTimer);
	});

	async function checkUpdates() {
		checking = true;
		try {
			await fetch('/api/update', { method: 'POST' });
			// The check itself finishes in well under a second (just a git
			// fetch) — one short delay then a reload is simpler and just as
			// accurate as trying to detect completion some other way.
			setTimeout(loadVersion, 1500);
		} finally {
			checking = false;
		}
	}

	async function installUpdate() {
		installing = true;
		try {
			await fetch('/api/update/install', { method: 'POST' });
			await loadVersion();
		} finally {
			installing = false;
		}
	}

	// "Later" only quiets the banner for this specific pending version, this
	// session — the update itself stays recorded server-side and the banner
	// comes back the moment a genuinely different check result shows up
	// (still polling means a background weekly check finding something
	// wouldn't otherwise ever surface).
	let dismissedTarget = $state<string | null>(null);
	function dismissUpdate() {
		dismissedTarget = version?.update?.targetCommit ?? null;
	}
	const showAvailable = $derived(
		version?.update?.status === 'available' && version.update.targetCommit !== dismissedTarget
	);

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
		<!-- Wi-Fi -->
		<section class="card">
			<div class="cardhead">
				<h2 class="type-heading">Wi-Fi</h2>
				<p class="type-caption sub">
					{#if wifiStatus === null}
						Checking…
					{:else if wifiStatus.online}
						Connected{wifiStatus.ssid ? ` to “${wifiStatus.ssid}”` : ''}.
					{:else}
						Not connected.
					{/if}
				</p>
			</div>
			{#if changingWifi}
				<WifiPicker
					onjoined={() => {
						changingWifi = false;
						loadWifiStatus();
					}}
				/>
				<button type="button" class="wifichange" onclick={() => (changingWifi = false)}
					>Cancel</button
				>
			{:else}
				<button type="button" class="wifichange pressable" onclick={() => (changingWifi = true)}>
					<Wifi size={16} />
					{wifiStatus?.online ? 'Change network' : 'Connect to Wi-Fi'}
				</button>
			{/if}
		</section>

		<!-- Screen type (chosen on first boot; changeable here as promised there) -->
		<section class="card">
			<div class="cardhead">
				<h2 class="type-heading">Screen type</h2>
				<p class="type-caption sub">
					Touchscreens get on-screen input; TVs show a permanent QR to control this screen from a
					phone.
				</p>
			</div>
			<div class="orient">
				{#each [{ v: 'tv', label: 'TV / Monitor' }, { v: 'touch', label: 'Touchscreen' }] as opt (opt.v)}
					<button
						type="button"
						class="orientbtn pressable"
						class:on={(family.displayMode ?? 'tv') === opt.v}
						onclick={async () => {
							family.displayMode = opt.v as 'tv' | 'touch';
							await fetch('/api/display-mode', {
								method: 'POST',
								headers: { 'content-type': 'application/json' },
								body: JSON.stringify({ displayMode: opt.v })
							}).catch(() => {});
						}}
					>
						<span class="type-label">{opt.label}</span>
					</button>
				{/each}
			</div>
		</section>

		<!-- Orientation -->
		<section class="card">
			<div class="cardhead">
				<h2 class="type-heading">Display orientation</h2>
				<p class="type-caption sub">
					Auto detects how your screen is mounted. Only force landscape or portrait if that's wrong
					for your hardware.
				</p>
			</div>
			<div class="orient">
				{#each [{ v: 'auto', label: 'Auto' }, { v: 'landscape', label: 'Landscape' }, { v: 'portrait', label: 'Portrait' }] as opt (opt.v)}
					<button
						type="button"
						class="orientbtn pressable"
						class:on={family.config.view.orientation === opt.v}
						onclick={() => {
							family.config.view.orientation = opt.v as 'auto' | 'landscape' | 'portrait';
							persist();
						}}
					>
						{#if opt.v === 'auto'}
							<span class="frame auto"><RefreshCw size={20} /></span>
						{:else}
							<span class="frame {opt.v}"></span>
						{/if}
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

		<!-- Routines -->
		<section class="card">
			<div class="cardhead">
				<h2 class="type-heading">Routines</h2>
				<p class="type-caption sub">
					Age-appropriate morning &amp; evening routines. Kids get them by default — turn off for
					anyone who shouldn't see them.
				</p>
			</div>
			<div class="rowset">
				{#each family.profiles as p (p.id)}
					{@const on = routinesOn(p)}
					<div class="row">
						<span class="type-body">{p.name}</span>
						<button
							type="button"
							class="switch"
							class:on
							role="switch"
							aria-checked={on}
							aria-label="Routines for {p.name}"
							onclick={() => {
								family.setRoutinesEnabled(p.id, !on);
								persist();
							}}><span class="knob"></span></button
						>
					</div>
				{/each}
				{#if family.profiles.length === 0}
					<p class="type-caption sub">Add people above first.</p>
				{/if}
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

		<!-- Sleep & screensaver settings live on the Sleep tab. -->

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

		<!-- Calendars -->
		<section class="card">
			<div class="cardhead">
				<h2 class="type-heading">Calendars</h2>
				<p class="type-caption sub">
					Subscribe to any calendar by link, or connect a Google account.
				</p>
			</div>
			<CalendarLinks />
			<div class="divider"></div>
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
						>Automatic checks <span class="hint type-caption">weekly — installing is separate</span
						></span
					>
					<button
						type="button"
						class="switch"
						class:on={!family.config.updates.paused}
						role="switch"
						aria-checked={!family.config.updates.paused}
						aria-label="Automatic checks"
						onclick={() => {
							family.config.updates.paused = !family.config.updates.paused;
							persist();
						}}
					>
						<span class="knob"></span>
					</button>
				</div>
			</div>

			<!-- Right under the settings above, as its own block: install progress. -->
			{#if version?.update?.status === 'installing'}
				<div class="updateblock installing">
					<p class="type-label">Installing update…</p>
					<div class="progressbar">
						<div class="progressfill" style:width="{version.update.progress ?? 0}%"></div>
					</div>
					<p class="type-caption hint">
						{version.update.progress ?? 0}% — the display will restart itself when it's done.
					</p>
				</div>
			{:else if showAvailable && version?.update}
				<div class="updateblock available">
					<p class="type-label">Update available</p>
					{#if version.update.notes?.length}
						<ul class="releasenotes">
							{#each version.update.notes as n (n)}<li class="type-caption">{n}</li>{/each}
						</ul>
					{/if}
					<div class="row">
						<button
							type="button"
							class="pairbtn small"
							disabled={installing}
							onclick={installUpdate}
						>
							{installing ? 'Starting…' : 'Install now'}
						</button>
						<button type="button" class="laterbtn" onclick={dismissUpdate}>Later</button>
					</div>
				</div>
			{:else if version?.update?.status === 'failed'}
				<div class="updateblock failed">
					<p class="type-label">Update failed</p>
					<p class="type-caption hint">{version.update.error ?? 'Something went wrong.'}</p>
					<button type="button" class="pairbtn small" disabled={checking} onclick={checkUpdates}>
						<RefreshCw size={15} /> Try again
					</button>
				</div>
			{/if}
		</section>

		<!-- Storage -->
		<section class="card">
			<div class="cardhead">
				<h2 class="type-heading">Data storage</h2>
				<p class="type-caption sub">Keep personal data local on this device, or on a NAS folder.</p>
			</div>
			<StoragePanel />
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
	.divider {
		height: 1px;
		background: var(--color-border-subtle);
		margin: var(--space-1) 0;
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
	.updateblock {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-4);
		margin-top: var(--space-2);
		border-radius: var(--radius-md);
		background: var(--color-surface-elevated);
	}
	.updateblock.failed {
		background: color-mix(in srgb, var(--color-accent-warning) 12%, var(--color-surface));
	}
	.progressbar {
		height: 8px;
		border-radius: var(--radius-pill);
		background: var(--color-border-subtle);
		overflow: hidden;
	}
	.progressfill {
		height: 100%;
		border-radius: var(--radius-pill);
		background: var(--color-accent-success);
		transition: width 0.6s ease;
	}
	.releasenotes {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.releasenotes li {
		padding-left: 14px;
		position: relative;
		color: var(--color-text-secondary);
	}
	.releasenotes li::before {
		content: '›';
		position: absolute;
		left: 0;
		color: var(--color-text-tertiary);
	}
	.laterbtn {
		padding: 8px 14px;
		border-radius: var(--radius-pill);
		color: var(--color-text-tertiary);
		font-weight: var(--weight-medium);
		font-size: var(--text-sm);
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
	.wifichange {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		align-self: flex-start;
		padding: 10px 18px;
		border-radius: var(--radius-pill);
		background: var(--color-surface-elevated);
		color: var(--color-text-primary);
		font-weight: var(--weight-medium);
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
	.frame.auto {
		width: 60px;
		height: 60px;
		display: grid;
		place-items: center;
		color: var(--color-text-secondary);
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
