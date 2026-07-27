<script lang="ts">
	import { Flame } from 'lucide-svelte';
	let { current, size = 'md' }: { current: number; size?: 'sm' | 'md' | 'lg' } = $props();
	const px = $derived({ sm: 15, md: 18, lg: 24 }[size]);
</script>

<span class="streak {size}" title="{current}-day streak">
	<Flame size={px} strokeWidth={2} />
	<span class="n">{current}</span>
</span>

<style>
	.streak {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: var(--color-accent-warning);
		font-weight: var(--weight-bold);
		font-variant-numeric: tabular-nums;
	}
	.sm .n {
		font-size: var(--text-sm);
	}
	.md .n {
		font-size: var(--text-lg);
	}
	.lg .n {
		font-size: var(--text-2xl);
	}
</style>
