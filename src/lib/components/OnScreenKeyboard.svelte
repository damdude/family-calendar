<script lang="ts">
	/**
	 * Touch-mode virtual keyboard.
	 *
	 * A touchscreen appliance has no physical keyboard, and Chromium under labwc
	 * doesn't provide one — so anything typed on the device (starting with the
	 * Wi-Fi password) needs this. Deliberately in-app rather than a compositor
	 * keyboard: it always works, and we control the layout and sizing for fingers.
	 */
	import { Delete, ArrowBigUp, Check } from 'lucide-svelte';

	let {
		value = $bindable(''),
		onenter,
		onclose
	}: { value: string; onenter?: () => void; onclose?: () => void } = $props();

	let shift = $state(true);
	let symbols = $state(false);

	const LETTERS = [
		['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
		['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
		['z', 'x', 'c', 'v', 'b', 'n', 'm']
	];
	const SYMBOLS = [
		['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
		['-', '/', ':', ';', '(', ')', '$', '&', '@', '"'],
		['.', ',', '?', '!', "'", '#', '%', '*', '+', '=']
	];

	const rows = $derived(symbols ? SYMBOLS : LETTERS);

	function press(key: string) {
		value += symbols ? key : shift ? key.toUpperCase() : key;
		// Auto-release shift after one character, like a phone keyboard.
		if (!symbols && shift) shift = false;
	}
	function backspace() {
		value = value.slice(0, -1);
	}
</script>

<div class="kb" role="group" aria-label="On-screen keyboard">
	{#each rows as row, i (i)}
		<div class="row">
			{#if i === 2 && !symbols}
				<button
					type="button"
					class="key mod"
					class:on={shift}
					aria-label="Shift"
					aria-pressed={shift}
					onclick={() => (shift = !shift)}><ArrowBigUp size={22} /></button
				>
			{/if}
			{#each row as k (k)}
				<button type="button" class="key" onclick={() => press(k)}>
					{symbols ? k : shift ? k.toUpperCase() : k}
				</button>
			{/each}
			{#if i === 2}
				<button type="button" class="key mod" aria-label="Backspace" onclick={backspace}>
					<Delete size={22} />
				</button>
			{/if}
		</div>
	{/each}

	<div class="row">
		<button type="button" class="key mod wide" onclick={() => (symbols = !symbols)}>
			{symbols ? 'ABC' : '?123'}
		</button>
		<button type="button" class="key space" aria-label="Space" onclick={() => press(' ')}></button>
		{#if onclose}
			<button type="button" class="key mod" aria-label="Close keyboard" onclick={() => onclose?.()}
				>Hide</button
			>
		{/if}
		{#if onenter}
			<button type="button" class="key mod go" aria-label="Done" onclick={() => onenter?.()}>
				<Check size={22} />
			</button>
		{/if}
	</div>
</div>

<style>
	.kb {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px;
		border-radius: var(--radius-lg);
		background: var(--color-surface-elevated);
		user-select: none;
	}
	.row {
		display: flex;
		gap: 6px;
		justify-content: center;
	}
	.key {
		flex: 1 1 0;
		/* Comfortably finger-sized on a 15" panel. */
		min-width: 0;
		min-height: 52px;
		display: grid;
		place-items: center;
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text-primary);
		font-size: 1.15rem;
		font-weight: var(--weight-medium);
		box-shadow: var(--shadow-card);
	}
	.key:active {
		background: var(--color-border-subtle);
		transform: translateY(1px);
	}
	.mod {
		flex: 0 0 auto;
		padding: 0 16px;
		background: var(--color-border-subtle);
		font-size: 0.95rem;
	}
	.mod.on {
		background: var(--color-text-primary);
		color: var(--color-surface);
	}
	.wide {
		padding: 0 20px;
	}
	.space {
		flex: 4 1 0;
	}
	.go {
		background: var(--color-accent-success);
		color: #fff;
	}
</style>
