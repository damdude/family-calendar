<script lang="ts">
	import type { FamilyEvent } from '$lib/types';
	import { family } from '$lib/stores/family.svelte';
	import { profileColorVar } from '$lib/design/colors';
	import { formatRange } from '$lib/time';
	import Avatar from './Avatar.svelte';

	let { event, variant = 'grid' }: { event: FamilyEvent; variant?: 'grid' | 'list' } = $props();

	// Who this event is assigned to — empty means "the whole family" (a
	// household calendar with no per-person tagging), not "nobody".
	const assignedPeople = $derived(
		event.profileIds.map((id) => family.profile(id)).filter((p) => p !== undefined)
	);
	// For the avatar stack specifically: a household event shows everyone's
	// icon at a glance, rather than none.
	const people = $derived(event.profileIds.length === 0 ? family.profiles : assignedPeople);

	function tint(color: Parameters<typeof profileColorVar>[0]) {
		return `color-mix(in srgb, ${profileColorVar(color)} 74%, white)`;
	}

	const background = $derived.by(() => {
		if (assignedPeople.length === 0) return 'var(--color-surface-elevated)';
		if (assignedPeople.length === 1) return tint(assignedPeople[0].color);
		// Two+ profiles → diagonal split (mirrors the reference's shared-event card).
		return `linear-gradient(135deg, ${tint(assignedPeople[0].color)} 0 46%, ${tint(assignedPeople[1].color)} 54% 100%)`;
	});

	const timeLabel = $derived(formatRange(event.start, event.end, family.config.view.clock24h));
</script>

<div class="card {variant}" style:background>
	<div class="body">
		<p class="title type-label">{event.title}</p>
		{#if !event.allDay}
			<p class="time type-caption">{timeLabel}</p>
		{/if}
		{#if event.location}
			<p class="loc type-caption">{event.location}</p>
		{/if}
	</div>
	{#if people.length}
		<div class="avatars">
			{#each people.slice(0, 3) as p (p.id)}
				<Avatar profile={p} size={22} ring={false} />
			{/each}
		</div>
	{/if}
</div>

<style>
	.card {
		position: relative;
		height: 100%;
		border-radius: var(--radius-md);
		padding: 8px 10px;
		box-shadow: var(--shadow-card);
		overflow: hidden;
		display: flex;
		flex-direction: column;
		justify-content: flex-start;
		container-type: size;
		container-name: eventcard;
	}
	.card.list {
		height: auto;
		min-height: 52px;
		justify-content: center;
	}
	.title {
		color: var(--color-text-primary);
		font-weight: var(--weight-semibold);
		overflow: hidden;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
	}
	.time,
	.loc {
		color: color-mix(in srgb, var(--color-text-primary) 62%, transparent);
		margin-top: 2px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	/* A short (~30-45min) grid block has room for the title + time but not
	   also the location without clipping mid-word — drop it rather than show
	   a garbled fragment. List view (fixed min-height) always has room. */
	@container eventcard (max-height: 44px) {
		.loc {
			display: none;
		}
	}
	.avatars {
		position: absolute;
		top: 6px;
		right: 6px;
		display: flex;
	}
	.avatars :global(.avatar) {
		box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.85);
	}
	.avatars :global(.avatar:not(:first-child)) {
		margin-left: -8px;
	}
</style>
