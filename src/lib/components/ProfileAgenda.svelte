<script lang="ts">
	import { family } from '$lib/stores/family.svelte';
	import type { FamilyEvent } from '$lib/types';
	import { sameDay } from '$lib/time';
	import EventCard from './EventCard.svelte';

	let { profileId, days = 7 }: { profileId: number; days?: number } = $props();

	function dayHeading(d: Date): string {
		const today = new Date();
		const tomorrow = new Date(today);
		tomorrow.setDate(tomorrow.getDate() + 1);
		if (sameDay(d, today)) return 'Today';
		if (sameDay(d, tomorrow)) return 'Tomorrow';
		return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
	}

	const grouped = $derived.by(() => {
		const start = new Date();
		start.setHours(0, 0, 0, 0);
		const end = new Date(start);
		end.setDate(end.getDate() + days);

		const evs = family
			.eventsForProfile(profileId)
			.filter((e) => e.end >= new Date() && e.start < end)
			.sort((a, b) => a.start.getTime() - b.start.getTime());

		const groups: { key: string; date: Date; events: FamilyEvent[] }[] = [];
		for (const e of evs) {
			const dayKey = e.start.toDateString();
			let g = groups.find((x) => x.key === dayKey);
			if (!g) {
				g = { key: dayKey, date: new Date(e.start), events: [] };
				groups.push(g);
			}
			g.events.push(e);
		}
		return groups;
	});
</script>

{#if grouped.length === 0}
	<p class="empty type-body">Nothing scheduled. Enjoy the free time! ✨</p>
{:else}
	<div class="agenda">
		{#each grouped as g (g.key)}
			<div class="day">
				<h3 class="type-label heading">{dayHeading(g.date)}</h3>
				<div class="events">
					{#each g.events as e (e.id)}
						<EventCard event={e} variant="list" />
					{/each}
				</div>
			</div>
		{/each}
	</div>
{/if}

<style>
	.agenda {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	.heading {
		color: var(--color-text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		margin-bottom: var(--space-2);
	}
	.events {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.empty {
		color: var(--color-text-secondary);
	}
</style>
