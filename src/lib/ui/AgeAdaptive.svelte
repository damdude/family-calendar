<script lang="ts">
	import type { Profile } from '$lib/types';
	import PreReaderUI from './PreReaderUI.svelte';
	import SchoolAgeUI from './SchoolAgeUI.svelte';
	import AdultUI from './AdultUI.svelte';

	let { profile }: { profile: Profile } = $props();

	// Age bands (spec):
	//   < 5   → pre-reader (icon-only, ≥96px targets)
	//   5–17  → school-age / teen (icons + text, rewards + streaks)
	//   ≥ 18  → adult (calendar + tasks, minimal celebration)
</script>

{#if profile.age < 5}
	<PreReaderUI {profile} />
{:else if profile.age < 18}
	<SchoolAgeUI {profile} />
{:else}
	<AdultUI {profile} />
{/if}
