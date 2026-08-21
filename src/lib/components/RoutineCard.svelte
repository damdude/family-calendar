<script lang="ts">
	import type { Routine } from '$lib/types';
	import { family } from '$lib/stores/family.svelte';
	import { profileColorVar, profileTint } from '$lib/design/colors';
	import RoutineIcon from '$lib/icons/RoutineIcon.svelte';
	import StreakBadge from './StreakBadge.svelte';
	import { ChevronRight } from 'lucide-svelte';

	let { routine }: { routine: Routine } = $props();

	const profile = $derived(family.profile(routine.profileId));
	const done = $derived(routine.steps.filter((s) => s.done).length);
	const total = $derived(routine.steps.length);
	const complete = $derived(total > 0 && done === total);
	const timeIcon = $derived(routine.timeOfDay === 'evening' ? 'moon' : 'sun');
	const cta = $derived(complete ? 'Done for today 🎉' : done > 0 ? 'Continue' : 'Start');
</script>

<a
	class="rcard pressable"
	href="/routine/{routine.id}"
	style:--accent={profile ? profileColorVar(profile.color) : 'var(--color-profile-blue)'}
	style:background={profile ? profileTint(profile.color, 22) : 'var(--color-surface)'}
>
	<span class="badge">
		<RoutineIcon icon={timeIcon} size={26} />
	</span>
	<span class="info">
		<span class="name type-body-lg">{routine.name}</span>
		<span class="progress-row">
			<span class="track"
				><span class="fill" style:width="{total ? (done / total) * 100 : 0}%"></span></span
			>
			<span class="count type-caption">{done}/{total}</span>
		</span>
	</span>
	<span class="right">
		<StreakBadge current={routine.streak.current} size="sm" />
		<span class="cta type-caption">{cta} <ChevronRight size={14} /></span>
	</span>
</a>

<style>
	.rcard {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-4);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-card);
	}
	.badge {
		display: grid;
		place-items: center;
		width: 52px;
		height: 52px;
		flex: none;
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--accent) 45%, var(--color-surface));
		color: color-mix(in srgb, var(--accent) 60%, var(--color-text-primary));
	}
	.info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-width: 0;
	}
	.name {
		color: var(--color-text-primary);
	}
	.progress-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.track {
		flex: 1;
		height: 8px;
		border-radius: var(--radius-pill);
		background: color-mix(in srgb, var(--accent) 25%, white);
		overflow: hidden;
	}
	.fill {
		display: block;
		height: 100%;
		border-radius: var(--radius-pill);
		background: var(--accent);
		transition: width var(--dur-standard) var(--ease-out);
	}
	.count {
		color: var(--color-text-secondary);
		font-variant-numeric: tabular-nums;
	}
	.right {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 6px;
		flex: none;
	}
	.cta {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		color: var(--color-text-secondary);
		white-space: nowrap;
	}
</style>
