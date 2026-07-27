<script lang="ts">
	import type { RoutineIcon } from '$lib/types';

	let { icon, size = 40 }: { icon: RoutineIcon; size?: number } = $props();
</script>

<!--
  Custom routine-step icons. Monochrome, drawn with currentColor so the parent
  card tints them per profile. 24×24 viewBox, rounded caps/joins for a soft,
  kid-friendly line style.
-->
<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.7"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	{#if icon === 'toothbrush'}
		<path d="M4 20l7-7" />
		<path d="M13.5 6.5l4 4" />
		<rect x="12.5" y="3.2" width="8.4" height="5" rx="2.5" transform="rotate(45 16.7 5.7)" />
		<path d="M14.8 8.2l1 1M16.3 6.7l1 1M17.8 5.2l1 1" />
	{:else if icon === 'bed'}
		<path d="M3 8v10M3 14h18v4M21 14v-3a2 2 0 0 0-2-2H9v5" />
		<circle cx="6.5" cy="11.5" r="1.6" />
	{:else if icon === 'backpack'}
		<path d="M6 8a6 6 0 0 1 12 0v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z" />
		<path d="M9 8a3 3 0 0 1 6 0" />
		<path d="M9 13h6v4H9z" />
		<path d="M9 20v1M15 20v1" />
	{:else if icon === 'shoes'}
		<path d="M3 15v-4l4 1 3 3h7a4 4 0 0 1 4 4v1H4a1 1 0 0 1-1-1z" />
		<path d="M7 12l1.5 2M10 12l1.5 2" />
	{:else if icon === 'plate'}
		<circle cx="12" cy="12" r="8" />
		<circle cx="12" cy="12" r="4.2" />
	{:else if icon === 'book'}
		<path
			d="M12 6C10.5 4.8 8 4.5 4.5 5v13c3.5-.5 6 0 7.5 1 1.5-1 4-1.5 7.5-1V5C16 4.5 13.5 4.8 12 6z"
		/>
		<path d="M12 6v13" />
	{:else if icon === 'shirt'}
		<path d="M8 4L4 7l2 3 2-1v9h8v-9l2 1 2-3-4-3-2 2h-4z" />
	{:else if icon === 'bath'}
		<path d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" />
		<path d="M6 12V6a2 2 0 0 1 4 0" />
		<path d="M8.5 6.2h1.2" />
		<path d="M7 21l-.7 1M17 21l.7 1" />
	{:else if icon === 'water'}
		<path d="M12 3s6 6.5 6 10.5A6 6 0 0 1 6 13.5C6 9.5 12 3 12 3z" />
	{:else if icon === 'brush-hair'}
		<rect x="8" y="3" width="8" height="11" rx="4" />
		<path d="M12 14v7" />
		<path d="M9.5 8h5M9.5 10.5h5" />
	{:else if icon === 'lunchbox'}
		<rect x="4" y="8" width="16" height="11" rx="2" />
		<path d="M9 8V6a3 3 0 0 1 6 0v2" />
		<path d="M4 13h16" />
	{:else if icon === 'moon'}
		<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />
	{:else if icon === 'sun'}
		<circle cx="12" cy="12" r="4.5" />
		<path
			d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"
		/>
	{:else if icon === 'star'}
		<path d="M12 3l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.6 9.1l5.8-.8z" />
	{/if}
</svg>
