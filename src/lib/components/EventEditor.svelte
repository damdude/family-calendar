<script lang="ts">
	import { untrack } from 'svelte';
	import { family } from '$lib/stores/family.svelte';
	import type { LocalEvent } from '$lib/stores/family.svelte';
	import { profileColorVar, profileTint } from '$lib/design/colors';
	import { dateKey } from '$lib/time';
	import { X, Trash2 } from 'lucide-svelte';

	let {
		existing = null,
		onClose,
		onSaved
	}: {
		existing?: LocalEvent | null;
		onClose: () => void;
		onSaved: () => void;
	} = $props();

	function toDate(ts: number) {
		return new Date(ts * 1000);
	}
	function hhmm(d: Date) {
		return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
	}

	// Seed the form once from `existing` (the editor is re-mounted per open).
	const ex = untrack(() => existing);
	const init = ex ? toDate(ex.startTs) : new Date();
	const initEnd = ex ? toDate(ex.endTs) : new Date(Date.now() + 3_600_000);

	let title = $state(ex?.title ?? '');
	let date = $state(dateKey(init));
	let startTime = $state(hhmm(init));
	let endTime = $state(hhmm(initEnd));
	let allDay = $state(ex?.allDay ?? false);
	let location = $state(ex?.location ?? '');
	let profileIds = $state<number[]>(ex?.profileIds ? [...ex.profileIds] : []);
	let calendarId = $state(ex?.calendarId ?? 1);
	let error = $state('');

	function toggleProfile(id: number) {
		profileIds = profileIds.includes(id) ? profileIds.filter((x) => x !== id) : [...profileIds, id];
	}

	function tsFrom(d: string, t: string): number {
		const [y, m, day] = d.split('-').map(Number);
		const [hh, mm] = t.split(':').map(Number);
		return Math.floor(new Date(y, m - 1, day, hh, mm, 0, 0).getTime() / 1000);
	}

	function save() {
		if (!title.trim()) {
			error = 'Give the event a title.';
			return;
		}
		let startTs: number;
		let endTs: number;
		if (allDay) {
			const [y, m, day] = date.split('-').map(Number);
			startTs = Math.floor(new Date(y, m - 1, day, 0, 0).getTime() / 1000);
			endTs = Math.floor(new Date(y, m - 1, day, 23, 59).getTime() / 1000);
		} else {
			startTs = tsFrom(date, startTime);
			endTs = tsFrom(date, endTime);
			if (endTs <= startTs) endTs = startTs + 3_600;
		}
		const payload = {
			title: title.trim(),
			startTs,
			endTs,
			allDay,
			location: location.trim() || undefined,
			profileIds,
			calendarId
		};
		if (existing) {
			family.removeLocalEvent(existing.id);
		}
		family.addLocalEvent(payload);
		onSaved();
	}

	function del() {
		if (existing) family.removeLocalEvent(existing.id);
		onSaved();
	}
</script>

<div
	class="scrim"
	role="button"
	tabindex="-1"
	onclick={onClose}
	onkeydown={(e) => e.key === 'Escape' && onClose()}
></div>
<div class="modal" role="dialog" aria-modal="true" aria-label="New event">
	<header class="mhead">
		<h2 class="type-title">{existing ? 'Edit event' : 'New event'}</h2>
		<button type="button" class="close" aria-label="Close" onclick={onClose}><X size={20} /></button
		>
	</header>

	<label class="field">
		<span class="type-label lbl">Title</span>
		<input
			class="in"
			type="text"
			placeholder="e.g. Soccer practice"
			bind:value={title}
			maxlength="120"
		/>
	</label>

	<div class="field">
		<span class="type-label lbl">People</span>
		<div class="chips">
			{#each family.profiles as p (p.id)}
				<button
					type="button"
					class="chip"
					class:on={profileIds.includes(p.id)}
					style:background={profileIds.includes(p.id) ? profileTint(p.color, 45) : ''}
					style:box-shadow={profileIds.includes(p.id)
						? `inset 0 0 0 2px ${profileColorVar(p.color)}`
						: ''}
					onclick={() => toggleProfile(p.id)}>{p.avatarEmoji} {p.name}</button
				>
			{/each}
		</div>
	</div>

	<label class="field">
		<span class="type-label lbl">Calendar</span>
		<select class="in" bind:value={calendarId}>
			{#each family.localCalendars as c (c.id)}
				<option value={c.id}
					>{c.name}{c.profileId ? ` (${family.profile(c.profileId)?.name ?? ''})` : ''}</option
				>
			{/each}
		</select>
	</label>

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
			<label class="field grow">
				<span class="type-label lbl">Start</span>
				<input class="in" type="time" bind:value={startTime} />
			</label>
			<label class="field grow">
				<span class="type-label lbl">End</span>
				<input class="in" type="time" bind:value={endTime} />
			</label>
		</div>
	{/if}

	<label class="field">
		<span class="type-label lbl">Location (optional)</span>
		<input class="in" type="text" bind:value={location} maxlength="120" />
	</label>

	{#if error}<p class="type-caption err">{error}</p>{/if}

	<footer class="foot">
		{#if existing}
			<button type="button" class="btn danger" onclick={del}><Trash2 size={16} /> Delete</button>
		{:else}
			<span></span>
		{/if}
		<button type="button" class="btn primary" onclick={save}
			>{existing ? 'Save' : 'Add event'}</button
		>
	</footer>
</div>

<style>
	.scrim {
		position: fixed;
		inset: 0;
		z-index: 150;
		background: rgba(20, 20, 20, 0.35);
		backdrop-filter: blur(2px);
	}
	.modal {
		position: fixed;
		z-index: 151;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		width: min(440px, calc(100vw - 32px));
		max-height: 90vh;
		overflow-y: auto;
		background: var(--color-surface);
		border-radius: var(--radius-xl);
		box-shadow: var(--shadow-float);
		padding: var(--space-5);
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	.mhead {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.close {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		border-radius: var(--radius-pill);
		color: var(--color-text-secondary);
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
		padding: 11px 13px;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border-subtle);
		background: var(--color-surface);
		color: var(--color-text-primary);
		font-size: var(--text-base);
	}
	.row {
		display: flex;
		gap: var(--space-3);
		align-items: flex-end;
	}
	.grow {
		flex: 1;
	}
	.allday {
		align-items: flex-start;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.chip {
		padding: 7px 12px;
		border-radius: var(--radius-pill);
		background: var(--color-surface-elevated);
		font-weight: var(--weight-medium);
		font-size: var(--text-sm);
	}
	.switch {
		width: 48px;
		height: 28px;
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
		width: 22px;
		height: 22px;
		border-radius: var(--radius-pill);
		background: white;
		box-shadow: var(--shadow-card);
	}
	.foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		margin-top: var(--space-2);
	}
	.btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 11px 20px;
		border-radius: var(--radius-pill);
		font-weight: var(--weight-semibold);
	}
	.btn.primary {
		background: var(--color-text-primary);
		color: var(--color-surface);
	}
	.btn.danger {
		background: color-mix(in srgb, var(--color-accent-warning) 15%, white);
		color: var(--color-accent-warning);
	}
	.err {
		color: var(--color-accent-warning);
	}
</style>
