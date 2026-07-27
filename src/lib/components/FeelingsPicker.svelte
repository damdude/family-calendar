<script lang="ts">
	import { defaultFeelings } from '$lib/config';
	import type { Feeling } from '$lib/types';

	let {
		selected = $bindable(undefined),
		compact = false
	}: { selected?: Feeling; compact?: boolean } = $props();

	function pick(f: Feeling) {
		selected = f;
	}
</script>

<div class="feelings" class:compact role="group" aria-label="How are you feeling today?">
	{#each defaultFeelings as f (f.label)}
		<button
			type="button"
			class="feeling pressable"
			class:on={selected?.label === f.label}
			onclick={() => pick(f)}
			aria-pressed={selected?.label === f.label}
		>
			<span class="emoji">{f.emoji}</span>
			{#if !compact}<span class="label type-caption">{f.label}</span>{/if}
		</button>
	{/each}
</div>

<style>
	.feelings {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		justify-content: center;
	}
	.feeling {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 14px;
		min-width: var(--touch-kid);
		min-height: var(--touch-kid);
		justify-content: center;
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		box-shadow: var(--shadow-card);
		transition:
			transform var(--dur-quick) var(--ease-out),
			box-shadow var(--dur-quick) var(--ease-out);
	}
	.feeling.on {
		box-shadow: 0 0 0 3px var(--color-accent-gold);
		transform: translateY(-2px);
	}
	.compact .feeling {
		min-width: 60px;
		min-height: 60px;
		padding: 8px;
	}
	.emoji {
		font-size: 2.4rem;
		line-height: 1;
	}
	.compact .emoji {
		font-size: 1.8rem;
	}
	.label {
		color: var(--color-text-secondary);
	}
</style>
