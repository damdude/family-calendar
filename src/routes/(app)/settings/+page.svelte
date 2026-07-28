<script lang="ts">
	import { family } from '$lib/stores/family.svelte';
	import type { FeatureFlags } from '$lib/config';
	import ProfileEditor from '$lib/components/ProfileEditor.svelte';
	import GoogleConnect from '$lib/components/GoogleConnect.svelte';
	import { QrCode, Check } from 'lucide-svelte';

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
			<p class="type-caption sub">Tap a photo to upload one. Photos are encrypted on the device.</p>
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

	<!-- Pairing -->
	<section class="card">
		<div class="cardhead"><h2 class="type-heading">Pair a phone</h2></div>
		<p class="type-body sub">Open the setup wizard to reconfigure from your phone.</p>
		<a class="pairbtn pressable" href="/setup"><QrCode size={18} /> Show pairing code</a>
	</section>
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
</style>
