<script lang="ts">
	import { Star } from 'lucide-svelte';
	let { stars, size = 'md' }: { stars: number; size?: 'sm' | 'md' | 'lg' } = $props();
	const px = $derived({ sm: 15, md: 18, lg: 26 }[size]);
</script>

<span class="tally {size}" title="{stars} stars">
	<Star
		size={px}
		strokeWidth={2}
		fill="var(--color-accent-gold)"
		color="var(--color-accent-gold)"
	/>
	<span class="n">{stars}</span>
</span>

<style>
	.tally {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		color: var(--color-text-primary);
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
