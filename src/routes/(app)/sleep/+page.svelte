<script lang="ts">
	import { family } from '$lib/stores/family.svelte';
	import { screensaver } from '$lib/stores/screensaver.svelte';
	import { isWithinWindow } from '$lib/time';
	import { Moon, Sun } from 'lucide-svelte';

	// Persist config changes (debounced).
	let saveTimer: ReturnType<typeof setTimeout>;
	function persist() {
		clearTimeout(saveTimer);
		saveTimer = setTimeout(() => {
			fetch('/api/config', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(family.toPersisted())
			}).catch(() => {});
		}, 400);
	}

	let now = $state(new Date());
	$effect(() => {
		const id = setInterval(() => (now = new Date()), 30000);
		return () => clearInterval(id);
	});
	const sleeping = $derived(
		family.config.sleep.enabled &&
			isWithinWindow(now, family.config.sleep.start, family.config.sleep.end)
	);
</script>

<div class="sleep-page">
	<h1 class="type-title page-title">Sleep</h1>

	<section class="card status" class:asleep={sleeping || screensaver.forceSleep}>
		<div class="icon">
			{#if sleeping || screensaver.forceSleep}<Moon size={34} />{:else}<Sun size={34} />{/if}
		</div>
		<div>
			<p class="type-heading">
				{sleeping || screensaver.forceSleep ? 'Screen is sleeping' : 'Screen is awake'}
			</p>
			<p class="type-body sub">
				{#if family.config.sleep.enabled}
					Quiet hours {family.config.sleep.start} – {family.config.sleep.end}
				{:else}
					Scheduled sleep is off
				{/if}
			</p>
		</div>
		<button
			type="button"
			class="sleepnow"
			onclick={() => (screensaver.forceSleep = !screensaver.forceSleep)}
		>
			{screensaver.forceSleep ? 'Wake now' : 'Sleep now'}
		</button>
	</section>

	<section class="card">
		<div class="cardhead"><h2 class="type-heading">Sleep schedule</h2></div>
		<div class="rowset">
			<div class="row">
				<span class="type-label">Sleep on a schedule</span>
				<button
					type="button"
					class="switch"
					class:on={family.config.sleep.enabled}
					role="switch"
					aria-checked={family.config.sleep.enabled}
					aria-label="Scheduled sleep"
					onclick={() => {
						family.config.sleep.enabled = !family.config.sleep.enabled;
						persist();
					}}><span class="knob"></span></button
				>
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

	<section class="card">
		<div class="cardhead"><h2 class="type-heading">Screensaver</h2></div>
		<div class="rowset">
			<div class="row">
				<span class="type-label">Show a screensaver</span>
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
					}}><span class="knob"></span></button
				>
			</div>
			<div class="row">
				<span class="type-label">Style</span>
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
					<button
						type="button"
						class="seg"
						class:on={family.config.screensaver.mode === 'vestaboard'}
						onclick={() => {
							family.config.screensaver.mode = 'vestaboard';
							persist();
						}}>Vestaboard</button
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
		</div>
	</section>

	{#if family.config.screensaver.mode === 'vestaboard'}
		{@const vb = family.config.screensaver.vestaboard}
		<section class="card">
			<div class="cardhead">
				<h2 class="type-heading">Vestaboard messages</h2>
				<p class="type-caption sub">
					Split-flap board shown when the screen is idle. Add greetings like “Welcome home” or
					“Happy Birthday Enaya”.
				</p>
			</div>

			<div class="msgs">
				{#each vb.messages as _msg, i (i)}
					<div class="msgrow">
						<input
							class="msgin"
							type="text"
							maxlength="120"
							placeholder="Message…"
							bind:value={vb.messages[i]}
							onchange={persist}
						/>
						<button
							type="button"
							class="msgdel"
							aria-label="Remove message"
							onclick={() => {
								vb.messages.splice(i, 1);
								persist();
							}}>✕</button
						>
					</div>
				{/each}
				<button
					type="button"
					class="addmsg"
					onclick={() => {
						vb.messages.push('');
						persist();
					}}>+ Add message</button
				>
			</div>

			<div class="rowset">
				{#each [['showWeather', 'Weather'], ['showEvents', 'Upcoming events'], ['showKids', 'Kids & streaks'], ['showJokes', 'Joke of the day'], ['showNews', 'Headlines from Sites of Interest']] as [key, label] (key)}
					<div class="row">
						<span class="type-label">{label}</span>
						<button
							type="button"
							class="switch"
							class:on={vb[key as keyof typeof vb]}
							role="switch"
							aria-checked={vb[key as keyof typeof vb] as boolean}
							aria-label={label}
							onclick={() => {
								// @ts-expect-error indexed boolean toggle
								vb[key] = !vb[key];
								persist();
							}}><span class="knob"></span></button
						>
					</div>
				{/each}
				<div class="row">
					<span class="type-label">Seconds per board</span>
					<div class="segmented">
						{#each [8, 12, 20, 30] as s (s)}
							<button
								type="button"
								class="seg"
								class:on={vb.holdSeconds === s}
								onclick={() => {
									vb.holdSeconds = s;
									persist();
								}}>{s}s</button
							>
						{/each}
					</div>
				</div>
			</div>
		</section>
	{/if}
</div>

<style>
	.sleep-page {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding-top: var(--space-2);
		max-width: 680px;
	}
	.page-title {
		color: var(--color-text-primary);
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
	.status {
		flex-direction: row;
		align-items: center;
		gap: var(--space-4);
	}
	.status .icon {
		display: grid;
		place-items: center;
		width: 60px;
		height: 60px;
		border-radius: var(--radius-pill);
		background: var(--color-accent-gold);
		color: #5a4200;
		flex: none;
	}
	.status.asleep .icon {
		background: #1a1a2e;
		color: #cfd8ff;
	}
	.status > div:nth-child(2) {
		flex: 1;
	}
	.sub {
		color: var(--color-text-secondary);
	}
	.sleepnow {
		padding: 11px 18px;
		border-radius: var(--radius-pill);
		background: var(--color-text-primary);
		color: var(--color-surface);
		font-weight: var(--weight-semibold);
	}
	.cardhead {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
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
	.switch {
		width: 48px;
		height: 28px;
		border-radius: var(--radius-pill);
		background: var(--color-border-subtle);
		padding: 3px;
		display: flex;
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
	.msgs {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.msgrow {
		display: flex;
		gap: var(--space-2);
		align-items: center;
	}
	.msgin {
		flex: 1;
		padding: 10px 12px;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border-subtle);
		background: var(--color-surface);
		color: var(--color-text-primary);
	}
	.msgdel {
		width: 34px;
		height: 34px;
		flex: none;
		border-radius: var(--radius-pill);
		color: var(--color-text-tertiary);
	}
	.msgdel:hover {
		color: var(--color-accent-warning);
	}
	.addmsg {
		align-self: flex-start;
		padding: 8px 14px;
		border-radius: var(--radius-pill);
		background: var(--color-surface-elevated);
		color: var(--color-text-primary);
		font-weight: var(--weight-medium);
		font-size: var(--text-sm);
	}
</style>
