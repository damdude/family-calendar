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

	// Mixed toward the theme's surface color, not hardcoded white — in dark
	// mode that stayed a light pastel while the text flipped to near-white on
	// top of it, making the title unreadable. Confirmed on-device.
	function tint(color: Parameters<typeof profileColorVar>[0]) {
		return `color-mix(in srgb, ${profileColorVar(color)} 74%, var(--color-surface))`;
	}

	const background = $derived.by(() => {
		if (assignedPeople.length === 0) return 'var(--color-surface-elevated)';
		if (assignedPeople.length === 1) return tint(assignedPeople[0].color);
		// Two+ profiles → diagonal split (mirrors the reference's shared-event card).
		return `linear-gradient(135deg, ${tint(assignedPeople[0].color)} 0 46%, ${tint(assignedPeople[1].color)} 54% 100%)`;
	});

	const timeLabel = $derived(formatRange(event.start, event.end, family.config.view.clock24h));
	// Time + location share one line — a separate line each ate too much
	// vertical space on an ordinary ~1hr grid block, so location was silently
	// dropping off events it should absolutely still show on.
	const metaLine = $derived.by(() => {
		const parts: string[] = [];
		if (!event.allDay) parts.push(timeLabel);
		if (event.location) parts.push(event.location);
		return parts.join(' · ');
	});
	// The grid block's rendered height tracks duration, and only the
	// tightest slivers (well under an hour) genuinely have no room for a
	// second line — a CSS container query here turned out unreliable inside
	// this absolute-positioned/percentage-height layout (misfired even when
	// the container was well above the threshold), so this checks the
	// duration directly instead of trying to read back the rendered size.
	const durationMinutes = $derived((event.end.getTime() - event.start.getTime()) / 60_000);
	const showMeta = $derived(variant === 'list' || event.allDay || durationMinutes >= 45);
</script>

<div class="card {variant}" style:background>
	<div class="body">
		<p class="title type-label">{event.title}</p>
		{#if metaLine && showMeta}
			<p class="meta type-caption">{metaLine}</p>
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
	}
	.card.list {
		height: auto;
		min-height: 52px;
		justify-content: center;
	}
	.title {
		color: var(--color-text-primary);
		font-weight: var(--weight-semibold);
		overflow-wrap: break-word;
	}
	.meta {
		color: color-mix(in srgb, var(--color-text-primary) 62%, transparent);
		margin-top: 2px;
		overflow-wrap: break-word;
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
