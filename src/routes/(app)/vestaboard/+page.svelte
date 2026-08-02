<script lang="ts">
	import { family } from '$lib/stores/family.svelte';
	import Vestaboard from '$lib/components/Vestaboard.svelte';
	import { goto } from '$app/navigation';
	import { X, Settings2 } from 'lucide-svelte';

	const vb = $derived(family.config.screensaver.vestaboard);

	let settingsOpen = $state(false);

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

	const toggles: [keyof typeof vb, string][] = [
		['showWeather', 'Weather'],
		['showEvents', 'Upcoming events'],
		['showKids', 'Kids & streaks'],
		['showJokes', 'Joke of the day'],
		['showNews', 'Headlines from Sites of Interest']
	];
</script>

<Vestaboard />

<!-- Floating controls sit above the board (z > 200). -->
{#if !family.readOnly}
	<div class="vb-controls">
		<button
			type="button"
			class="vb-btn"
			aria-label="Vestaboard settings"
			onclick={() => (settingsOpen = true)}><Settings2 size={22} /></button
		>
		<button type="button" class="vb-btn" aria-label="Exit Vestaboard" onclick={() => goto('/')}
			><X size={22} /></button
		>
	</div>
{:else}
	<button type="button" class="vb-btn solo" aria-label="Exit Vestaboard" onclick={() => goto('/')}
		><X size={22} /></button
	>
{/if}

{#if settingsOpen}
	<div
		class="scrim"
		role="button"
		tabindex="-1"
		aria-label="Close"
		onclick={() => (settingsOpen = false)}
		onkeydown={(e) => e.key === 'Escape' && (settingsOpen = false)}
	></div>
	<div class="panel" role="dialog" aria-modal="true">
		<header class="phead">
			<h2 class="type-title">Vestaboard</h2>
			<button type="button" class="close" aria-label="Close" onclick={() => (settingsOpen = false)}
				><X size={20} /></button
			>
		</header>

		<div class="sect">
			<p class="type-label">Custom messages</p>
			<p class="type-caption sub">
				Greetings that rotate on the board — “Welcome home”, “Happy Birthday Enaya”.
			</p>
			<div class="msgs">
				{#each vb.messages as _m, i (i)}
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
							}}><X size={16} /></button
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
		</div>

		<div class="sect">
			<p class="type-label">Show on the board</p>
			<div class="rowset">
				{#each toggles as [key, label] (key)}
					<div class="row">
						<span class="type-body">{label}</span>
						<button
							type="button"
							class="switch"
							class:on={vb[key] as boolean}
							role="switch"
							aria-checked={vb[key] as boolean}
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
					<span class="type-body">Seconds per board</span>
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
		</div>
	</div>
{/if}

<style>
	.vb-controls {
		position: fixed;
		top: clamp(12px, 2vmin, 24px);
		right: clamp(12px, 2vmin, 24px);
		z-index: 260;
		display: flex;
		gap: 10px;
	}
	.vb-btn {
		display: grid;
		place-items: center;
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.1);
		color: #f3ede0;
		backdrop-filter: blur(6px);
		opacity: 0.5;
		transition: opacity 0.15s ease;
	}
	.vb-btn:hover {
		opacity: 1;
		background: rgba(255, 255, 255, 0.2);
	}
	.vb-btn.solo {
		position: fixed;
		top: clamp(12px, 2vmin, 24px);
		right: clamp(12px, 2vmin, 24px);
		z-index: 260;
	}
	.scrim {
		position: fixed;
		inset: 0;
		z-index: 270;
		background: rgba(0, 0, 0, 0.5);
	}
	.panel {
		position: fixed;
		z-index: 271;
		right: 0;
		top: 0;
		bottom: 0;
		width: min(440px, 100vw);
		background: var(--color-surface);
		box-shadow: var(--shadow-float);
		padding: var(--space-5);
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	.phead {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.phead h2 {
		color: var(--color-text-primary);
	}
	.close {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border-radius: var(--radius-pill);
		color: var(--color-text-secondary);
	}
	.sect {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.type-label {
		color: var(--color-text-primary);
		font-weight: var(--weight-semibold);
	}
	.sub {
		color: var(--color-text-secondary);
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
		display: grid;
		place-items: center;
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
	.row .type-body {
		color: var(--color-text-primary);
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
		padding: 6px 12px;
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
</style>
