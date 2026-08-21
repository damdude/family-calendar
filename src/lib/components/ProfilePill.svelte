<script lang="ts">
	import type { Profile } from '$lib/types';
	import Avatar from './Avatar.svelte';
	import { profileColorVar, profileTint } from '$lib/design/colors';

	let { profile }: { profile: Profile } = $props();

	const complete = $derived(profile.tasks.total > 0 && profile.tasks.done >= profile.tasks.total);
</script>

<a
	class="pill pressable"
	href="/profile/{profile.id}"
	style:background={profileTint(profile.color, 32)}
	style:--pill-accent={profileColorVar(profile.color)}
>
	<Avatar {profile} size={30} />
	<span class="name type-label">{profile.name}</span>
	<span class="count type-caption" class:complete>
		{profile.tasks.done}/{profile.tasks.total}
	</span>
</a>

<style>
	.pill {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		padding: 4px 12px 4px 4px;
		border-radius: var(--radius-pill);
		white-space: nowrap;
	}
	.name {
		color: var(--color-text-primary);
	}
	.count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 34px;
		padding: 2px 8px;
		border-radius: var(--radius-pill);
		background: color-mix(in srgb, var(--pill-accent) 60%, var(--color-surface));
		color: color-mix(in srgb, var(--pill-accent) 60%, var(--color-text-primary));
	}
	.count.complete {
		/* Solid accent-success bg, unchanged across themes — the fixed dark
		   text keeps contrast either way, no need to mix toward the theme ink. */
		background: var(--color-accent-success);
		color: #10391f;
	}
</style>
