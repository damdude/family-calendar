<script lang="ts">
	import type { Weather } from '$lib/types';

	let { weather }: { weather: Weather } = $props();
</script>

<span class="chip" title={weather.condition}>
	<span class="glyph">{weather.icon}</span>
	<span class="temp type-body-lg">{weather.tempF}°</span>
</span>

<style>
	.chip {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}
	.glyph {
		font-size: 1.5rem;
		line-height: 1;
	}
	.temp {
		color: var(--color-text-primary);
	}
</style>
