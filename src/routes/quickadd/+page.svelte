<script lang="ts">
	import type { PageData } from './$types';
	import { profileColorVar, profileTint } from '$lib/design/colors';
	import { Check, Plus } from 'lucide-svelte';

	let { data }: { data: PageData } = $props();

	function pad(n: number) {
		return String(n).padStart(2, '0');
	}
	const now = new Date();
	let title = $state('');
	let date = $state(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
	let startTime = $state(`${pad(now.getHours())}:00`);
	let endTime = $state(`${pad(now.getHours() + 1)}:00`);
	let allDay = $state(false);
	let location = $state('');
	let profileIds = $state<number[]>([]);
	let saving = $state(false);
	let done = $state(false);
	let error = $state('');

	function toggle(id: number) {
		profileIds = profileIds.includes(id) ? profileIds.filter((x) => x !== id) : [...profileIds, id];
	}
	function ts(d: string, t: string): number {
		const [y, m, day] = d.split('-').map(Number);
		const [hh, mm] = t.split(':').map(Number);
		return Math.floor(new Date(y, m - 1, day, hh, mm).getTime() / 1000);
	}

	async function add() {
		if (!title.trim()) {
			error = 'Add a title.';
			return;
		}
		saving = true;
		error = '';
		let startTs: number;
		let endTs: number;
		if (allDay) {
			const [y, m, d] = date.split('-').map(Number);
			startTs = Math.floor(new Date(y, m - 1, d, 0, 0).getTime() / 1000);
			endTs = Math.floor(new Date(y, m - 1, d, 23, 59).getTime() / 1000);
		} else {
			startTs = ts(date, startTime);
			endTs = ts(date, endTime);
			if (endTs <= startTs) endTs = startTs + 3600;
		}
		try {
			const r = await fetch('/api/quickadd/event', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					token: data.token,
					title: title.trim(),
					startTs,
					endTs,
					allDay,
					location: location.trim() || undefined,
					profileIds
				})
			});
			if (r.ok) done = true;
			else error = (await r.json().catch(() => ({})))?.message ?? 'Could not add.';
		} finally {
			saving = false;
		}
	}

	function another() {
		done = false;
		title = '';
		location = '';
		profileIds = [];
	}
</script>

<div class="wrap">
	{#if done}
		<div class="donebox">
			<div class="tick"><Check size={38} strokeWidth={3} /></div>
			<h1 class="type-title">Added!</h1>
			<p class="type-body sub">It's on the family display now.</p>
			<button type="button" class="btn ghost" onclick={another}>Add another</button>
		</div>
	{:else}
		<header><span class="brand type-label">Add to Family Calendar</span></header>
		<label class="field">
			<span class="type-label lbl">Title</span>
			<input class="in" type="text" placeholder="e.g. Dentist" bind:value={title} maxlength="120" />
		</label>

		{#if data.profiles.length}
			<div class="field">
				<span class="type-label lbl">People</span>
				<div class="chips">
					{#each data.profiles as p (p.id)}
						<button
							type="button"
							class="chip"
							class:on={profileIds.includes(p.id)}
							style:background={profileIds.includes(p.id) ? profileTint(p.color, 45) : ''}
							style:box-shadow={profileIds.includes(p.id)
								? `inset 0 0 0 2px ${profileColorVar(p.color)}`
								: ''}
							onclick={() => toggle(p.id)}>{p.avatarEmoji} {p.name}</button
						>
					{/each}
				</div>
			</div>
		{/if}

		<div class="row">
			<label class="field grow">
				<span class="type-label lbl">Date</span>
				<input class="in" type="date" bind:value={date} />
			</label>
			<label class="field allday">
				<span class="type-label lbl">All day</span>
				<button
					type="button"
					class="switch"
					class:on={allDay}
					role="switch"
					aria-checked={allDay}
					aria-label="All day"
					onclick={() => (allDay = !allDay)}><span class="knob"></span></button
				>
			</label>
		</div>

		{#if !allDay}
			<div class="row">
				<label class="field grow"
					><span class="type-label lbl">Start</span><input
						class="in"
						type="time"
						bind:value={startTime}
					/></label
				>
				<label class="field grow"
					><span class="type-label lbl">End</span><input
						class="in"
						type="time"
						bind:value={endTime}
					/></label
				>
			</div>
		{/if}

		<label class="field">
			<span class="type-label lbl">Location (optional)</span>
			<input class="in" type="text" bind:value={location} maxlength="120" />
		</label>

		{#if error}<p class="type-caption err">{error}</p>{/if}
		<button type="button" class="btn primary" disabled={saving} onclick={add}>
			<Plus size={18} />
			{saving ? 'Adding…' : 'Add event'}
		</button>
	{/if}
</div>

<style>
	.wrap {
		max-width: 460px;
		margin: 0 auto;
		min-height: 100vh;
		padding: var(--space-5) var(--space-4) var(--space-8);
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	.brand {
		color: var(--color-text-tertiary);
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.lbl {
		color: var(--color-text-secondary);
	}
	.in {
		padding: 13px;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border-subtle);
		background: var(--color-surface);
		color: var(--color-text-primary);
		font-size: var(--text-lg);
	}
	.row {
		display: flex;
		gap: var(--space-3);
		align-items: flex-end;
	}
	.grow {
		flex: 1;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.chip {
		padding: 9px 14px;
		border-radius: var(--radius-pill);
		background: var(--color-surface-elevated);
		font-weight: var(--weight-medium);
	}
	.switch {
		width: 52px;
		height: 30px;
		border-radius: var(--radius-pill);
		background: var(--color-border-subtle);
		padding: 3px;
		display: flex;
	}
	.switch.on {
		background: var(--color-accent-success);
		justify-content: flex-end;
	}
	.knob {
		width: 24px;
		height: 24px;
		border-radius: var(--radius-pill);
		background: white;
		box-shadow: var(--shadow-card);
	}
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 15px 22px;
		border-radius: var(--radius-pill);
		font-weight: var(--weight-semibold);
		font-size: var(--text-lg);
	}
	.btn.primary {
		background: var(--color-text-primary);
		color: var(--color-surface);
	}
	.btn.ghost {
		background: var(--color-surface);
		box-shadow: var(--shadow-card);
	}
	.err {
		color: var(--color-accent-warning);
	}
	.donebox {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		gap: var(--space-3);
	}
	.tick {
		display: grid;
		place-items: center;
		width: 84px;
		height: 84px;
		border-radius: var(--radius-pill);
		background: var(--color-accent-success);
		color: white;
	}
	.sub {
		color: var(--color-text-secondary);
	}
</style>
