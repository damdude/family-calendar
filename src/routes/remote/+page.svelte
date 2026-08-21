<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { mirror } from '$lib/stores/mirror.svelte';
	import { profileColorVar, profileTint } from '$lib/design/colors';
	import { formatRange } from '$lib/time';
	import Avatar from '$lib/components/Avatar.svelte';
	import { Check, Plus, Smartphone } from 'lucide-svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	onMount(() => {
		// Identity for the heartbeat in the root layout — this device stays
		// right here, it doesn't drive the TV's navigation anymore.
		mirror.becomeController(data.token);
	});

	let stopped = $state(false);

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
	let justAdded = $state(false);
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
			const r = await fetch('/api/mirror/event', {
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
			if (r.ok) {
				justAdded = true;
				title = '';
				location = '';
				profileIds = [];
				await invalidateAll(); // pull the fresh event into "What's coming up"
				setTimeout(() => (justAdded = false), 2500);
			} else {
				error = (await r.json().catch(() => ({})))?.message ?? 'Could not add.';
			}
		} finally {
			saving = false;
		}
	}

	function done() {
		mirror.stop();
		stopped = true;
	}

	// --- "What's coming up" grouping ---
	function dayLabel(ts: number): string {
		const d = new Date(ts * 1000);
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const that = new Date(d);
		that.setHours(0, 0, 0, 0);
		const diffDays = Math.round((that.getTime() - today.getTime()) / 86_400_000);
		if (diffDays === 0) return 'Today';
		if (diffDays === 1) return 'Tomorrow';
		return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
	}
	const groups = $derived.by(() => {
		const out: { label: string; events: PageData['events'] }[] = [];
		for (const e of data.events) {
			const label = dayLabel(e.startTs);
			const last = out[out.length - 1];
			if (last && last.label === label) last.events.push(e);
			else out.push({ label, events: [e] });
		}
		return out;
	});
	function peopleFor(ids: number[]) {
		// Empty profileIds = the whole family, per the display's own convention.
		const list = ids.length === 0 ? data.profiles : data.profiles.filter((p) => ids.includes(p.id));
		return list.slice(0, 4);
	}
</script>

<svelte:head>
	<title>Family Calendar — Add</title>
</svelte:head>

{#if stopped}
	<div class="wrap closed">
		<div class="tick"><Check size={38} strokeWidth={3} /></div>
		<h1 class="type-title">All set</h1>
		<p class="type-body sub">You can close this tab now.</p>
	</div>
{:else}
	<div class="wrap">
		<header class="head">
			<div>
				<p class="brand type-caption">{data.familyName || 'Family Calendar'}</p>
				<h1 class="type-title">Add to the calendar</h1>
			</div>
			<button type="button" class="done" onclick={done}>Done</button>
		</header>
		<p class="live type-caption"><Smartphone size={13} /> Live — shows up on the display right away</p>

		<section class="card">
			<label class="field">
				<span class="type-label lbl">Title</span>
				<input
					class="in"
					type="text"
					placeholder="e.g. Dentist"
					bind:value={title}
					maxlength="120"
				/>
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
				{#if justAdded}<Check size={18} /> Added{:else}<Plus size={18} />{saving
						? 'Adding…'
						: 'Add event'}{/if}
			</button>
		</section>

		<h2 class="type-label upcoming-h">What's coming up</h2>
		{#if groups.length === 0}
			<p class="type-body sub empty">Nothing in the next two weeks.</p>
		{:else}
			<div class="agenda">
				{#each groups as g (g.label)}
					<div class="group">
						<p class="glabel type-caption">{g.label}</p>
						{#each g.events as e (e.id)}
							<div class="erow">
								<div class="etime type-caption">
									{e.allDay ? 'All day' : formatRange(new Date(e.startTs * 1000), new Date(e.endTs * 1000))}
								</div>
								<div class="ebody">
									<p class="etitle type-body">{e.title}</p>
									{#if e.location}<p class="eloc type-caption">{e.location}</p>{/if}
								</div>
								{#if peopleFor(e.profileIds).length}
									<div class="eavatars">
										{#each peopleFor(e.profileIds) as p (p.id)}
											<Avatar profile={p} size={22} ring={false} />
										{/each}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<style>
	:global(body) {
		background: var(--color-canvas, #fafafa);
	}
	.wrap {
		max-width: 460px;
		margin: 0 auto;
		min-height: 100vh;
		padding: var(--space-5) var(--space-4) var(--space-8);
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	.head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: var(--space-3);
	}
	.brand {
		color: var(--color-text-tertiary);
	}
	.done {
		padding: 8px 16px;
		border-radius: var(--radius-pill);
		background: var(--color-surface-elevated);
		color: var(--color-text-secondary);
		font-weight: var(--weight-semibold);
		font-size: var(--text-sm);
		flex: none;
	}
	.live {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--color-accent-success);
		margin-top: -8px;
	}
	.card {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		background: var(--color-surface);
		border-radius: var(--radius-xl);
		padding: var(--space-5);
		box-shadow: var(--shadow-card);
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
	.btn.primary:disabled {
		opacity: 0.6;
	}
	.err {
		color: var(--color-accent-warning);
	}
	.upcoming-h {
		color: var(--color-text-secondary);
	}
	.empty {
		color: var(--color-text-tertiary);
	}
	.agenda {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	.group {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.glabel {
		color: var(--color-text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.erow {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3);
		background: var(--color-surface);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-card);
	}
	.etime {
		flex: none;
		width: 84px;
		color: var(--color-text-tertiary);
	}
	.ebody {
		flex: 1;
		min-width: 0;
	}
	.etitle {
		color: var(--color-text-primary);
		font-weight: var(--weight-semibold);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.eloc {
		color: var(--color-text-tertiary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.eavatars {
		flex: none;
		display: flex;
	}
	.eavatars :global(.avatar:not(:first-child)) {
		margin-left: -8px;
	}
	.closed {
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
