<script lang="ts">
	import type { Profile } from '$lib/types';
	import { family } from '$lib/stores/family.svelte';
	import Avatar from '$lib/components/Avatar.svelte';
	import ProfileAgenda from '$lib/components/ProfileAgenda.svelte';

	let { profile }: { profile: Profile } = $props();

	const todayYmd = $derived.by(() => {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
			d.getDate()
		).padStart(2, '0')}`;
	});
	const todaysDinner = $derived(
		family.data.meals.find((m) => m.date === todayYmd && m.mealType === 'dinner')
	);
	// Lists this adult has completed items on, plus outstanding counts.
	const openTasks = $derived(
		family.data.lists.flatMap((l) => l.items).filter((i) => !i.completed).length
	);
</script>

<div class="adult">
	<header class="phead">
		<Avatar {profile} size={72} />
		<div class="idn">
			<h1 class="type-title-lg">{profile.name}</h1>
			<p class="type-body role">Parent · {profile.tasks.done}/{profile.tasks.total} tasks today</p>
		</div>
	</header>

	<div class="cols">
		<section class="panel wide">
			<h2 class="type-heading">Your week</h2>
			<ProfileAgenda profileId={profile.id} />
		</section>

		<aside class="side">
			<section class="panel">
				<h2 class="type-heading">Today</h2>
				<p class="stat">
					<span class="k type-label">Tasks left</span><span class="v">{openTasks}</span>
				</p>
				{#if todaysDinner}
					<p class="stat">
						<span class="k type-label">Dinner</span>
						<span class="v small">{todaysDinner.emoji} {todaysDinner.name}</span>
					</p>
				{/if}
				<p class="stat">
					<span class="k type-label">Weather</span>
					<span class="v small">{family.data.weather.icon} {family.data.weather.tempF}°</span>
				</p>
			</section>
		</aside>
	</div>
</div>

<style>
	.adult {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
		padding-top: var(--space-2);
	}
	.phead {
		display: flex;
		align-items: center;
		gap: var(--space-4);
	}
	.role {
		color: var(--color-text-secondary);
	}
	.cols {
		display: grid;
		grid-template-columns: 1fr 280px;
		gap: var(--space-4);
		align-items: start;
	}
	.panel {
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-card);
		padding: var(--space-5);
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	.stat {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
	}
	.k {
		color: var(--color-text-secondary);
	}
	.v {
		font-size: var(--text-2xl);
		font-weight: var(--weight-bold);
		color: var(--color-text-primary);
	}
	.v.small {
		font-size: var(--text-base);
		font-weight: var(--weight-semibold);
	}
	@media (max-width: 900px) {
		.cols {
			grid-template-columns: 1fr;
		}
	}
</style>
