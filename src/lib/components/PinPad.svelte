<script lang="ts">
	import { Delete, Lock } from 'lucide-svelte';

	let {
		title = 'Enter PIN',
		subtitle = '',
		onComplete
	}: {
		title?: string;
		subtitle?: string;
		/** Return true if accepted; false shows an error + clears. */
		onComplete: (pin: string) => Promise<boolean>;
	} = $props();

	let pin = $state('');
	let error = $state(false);
	let busy = $state(false);

	async function submit() {
		if (pin.length < 4 || busy) return;
		busy = true;
		error = false;
		const ok = await onComplete(pin);
		busy = false;
		if (!ok) {
			error = true;
			pin = '';
		}
	}

	function press(d: string) {
		if (pin.length >= 8) return;
		error = false;
		pin += d;
		if (pin.length >= 4) {
			// Auto-submit at a common 4-digit length after a brief beat.
		}
	}
	function back() {
		pin = pin.slice(0, -1);
	}
</script>

<div class="pad">
	<div class="lockicon"><Lock size={26} /></div>
	<h2 class="type-title">{title}</h2>
	{#if subtitle}<p class="type-body sub">{subtitle}</p>{/if}

	<div class="dots" class:error>
		{#each Array(Math.max(4, pin.length)) as _, i (i)}
			<span class="dot" class:filled={i < pin.length}></span>
		{/each}
	</div>
	{#if error}<p class="type-caption err">Incorrect PIN. Try again.</p>{/if}

	<div class="keys">
		{#each ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as d (d)}
			<button type="button" class="key pressable" onclick={() => press(d)}>{d}</button>
		{/each}
		<button type="button" class="key back" aria-label="Delete" onclick={back}
			><Delete size={20} /></button
		>
		<button type="button" class="key pressable" onclick={() => press('0')}>0</button>
		<button type="button" class="key ok" disabled={pin.length < 4 || busy} onclick={submit}
			>OK</button
		>
	</div>
</div>

<style>
	.pad {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3);
		max-width: 300px;
		margin: 0 auto;
		padding: var(--space-6) 0;
		text-align: center;
	}
	.lockicon {
		display: grid;
		place-items: center;
		width: 56px;
		height: 56px;
		border-radius: var(--radius-pill);
		background: var(--color-surface-elevated);
		color: var(--color-text-secondary);
	}
	.sub {
		color: var(--color-text-secondary);
	}
	.dots {
		display: flex;
		gap: var(--space-3);
		margin: var(--space-2) 0;
	}
	.dots.error {
		animation: shake 0.3s;
	}
	@keyframes shake {
		0%,
		100% {
			transform: translateX(0);
		}
		25% {
			transform: translateX(-6px);
		}
		75% {
			transform: translateX(6px);
		}
	}
	.dot {
		width: 14px;
		height: 14px;
		border-radius: var(--radius-pill);
		box-shadow: inset 0 0 0 2px var(--color-border-subtle);
	}
	.dot.filled {
		background: var(--color-text-primary);
		box-shadow: none;
	}
	.err {
		color: var(--color-accent-warning);
	}
	.keys {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--space-3);
		margin-top: var(--space-2);
	}
	.key {
		width: 72px;
		height: 72px;
		border-radius: var(--radius-pill);
		background: var(--color-surface);
		box-shadow: var(--shadow-card);
		font-size: var(--text-2xl);
		font-weight: var(--weight-medium);
		color: var(--color-text-primary);
		display: grid;
		place-items: center;
	}
	.key.back {
		background: transparent;
		box-shadow: none;
		color: var(--color-text-secondary);
	}
	.key.ok {
		background: var(--color-text-primary);
		color: var(--color-surface);
		font-size: var(--text-lg);
		font-weight: var(--weight-semibold);
	}
	.key.ok:disabled {
		opacity: 0.4;
	}
</style>
