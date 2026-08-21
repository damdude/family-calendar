<script lang="ts">
	import { family } from '$lib/stores/family.svelte';
	import { profileColorVar } from '$lib/design/colors';
	import { Link2, Plus, X, RefreshCw, CalendarPlus } from 'lucide-svelte';

	interface Cal {
		id: number;
		externalId: string;
		name: string | null;
		colorHex: string | null;
		profileId: number | null;
		lastSync: number | null;
	}

	let cals = $state<Cal[]>([]);
	let url = $state('');
	let name = $state('');
	let profileId = $state<number | ''>('');
	let busy = $state(false);
	let msg = $state('');

	async function load() {
		const r = await fetch('/api/calendars');
		if (r.ok) cals = await r.json();
	}
	$effect(() => {
		load();
	});

	async function add() {
		if (!url.trim()) return;
		busy = true;
		msg = '';
		try {
			const r = await fetch('/api/calendars', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					url: url.trim(),
					name: name.trim(),
					profileId: profileId === '' ? undefined : Number(profileId)
				})
			});
			if (r.ok) {
				const res = await r.json();
				cals = res.calendars;
				msg = `Added — synced ${res.count} events.`;
				url = '';
				name = '';
				profileId = '';
			} else {
				msg = (await r.json().catch(() => ({})))?.message ?? 'Could not add that link.';
			}
		} finally {
			busy = false;
		}
	}

	async function remove(id: number) {
		const r = await fetch('/api/calendars/remove', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ id })
		});
		if (r.ok) cals = (await r.json()).calendars;
	}

	async function syncNow() {
		busy = true;
		msg = '';
		try {
			const r = await fetch('/api/calendars/sync', { method: 'POST' });
			const res = await r.json().catch(() => ({}));
			msg = r.ok ? `Synced ${res.count} events.` : 'Sync failed.';
			await load();
		} finally {
			busy = false;
		}
	}

	function host(u: string) {
		try {
			return new URL(u).hostname;
		} catch {
			return u;
		}
	}

	// --- Local calendars (no external source — events are created right here) ---
	let localName = $state('');
	let localProfileId = $state<number | ''>('');
	let localMsg = $state('');

	function addLocal() {
		if (!localName.trim()) return;
		family.addLocalCalendar(
			localName.trim(),
			localProfileId === '' ? undefined : Number(localProfileId)
		);
		localName = '';
		localProfileId = '';
	}

	function removeLocal(id: number) {
		localMsg = family.removeLocalCalendar(id)
			? ''
			: 'Move its events to another calendar before deleting it.';
	}

	// A profile with neither a synced calendar nor a local calendar of their
	// own has nowhere to file their events yet.
	const profilesWithoutCalendar = $derived(
		family.profiles.filter(
			(p) =>
				!cals.some((c) => c.profileId === p.id) &&
				!family.localCalendars.some((c) => c.profileId === p.id)
		)
	);
</script>

<div class="cl">
	<div class="head">
		<p class="type-label"><Link2 size={16} /> Subscribe by link</p>
		{#if cals.length}
			<button type="button" class="refresh" disabled={busy} onclick={syncNow} aria-label="Sync now">
				<RefreshCw size={15} />
			</button>
		{/if}
	</div>
	<p class="type-caption sub">
		Paste any calendar's iCal / webcal link (Google's "secret iCal address", an iCloud or Outlook
		published calendar, or any ICS URL).
	</p>

	{#each cals as c (c.id)}
		<div class="cal">
			<span
				class="dot"
				style:background={c.profileId
					? profileColorVar(family.profile(c.profileId)?.color ?? 'sky')
					: 'var(--color-text-tertiary)'}
			></span>
			<span class="cname type-label">{c.name || host(c.externalId)}</span>
			<span class="chost type-caption">{host(c.externalId)}</span>
			<button type="button" class="del" aria-label="Remove" onclick={() => remove(c.id)}>
				<X size={14} />
			</button>
		</div>
	{/each}

	<div class="addform">
		<input class="in" type="url" placeholder="https://…/basic.ics or webcal://…" bind:value={url} />
		<div class="row2">
			<input class="in name" type="text" placeholder="Label (optional)" bind:value={name} />
			<select class="in sel" bind:value={profileId}>
				<option value="">Whole family</option>
				{#each family.profiles as p (p.id)}
					<option value={p.id}>{p.name}</option>
				{/each}
			</select>
			<button type="button" class="add" disabled={busy || !url.trim()} onclick={add}>
				<Plus size={16} /> Add
			</button>
		</div>
	</div>
	{#if msg}<p class="type-caption msg">{msg}</p>{/if}

	{#if profilesWithoutCalendar.length}
		<div class="nocal">
			{#each profilesWithoutCalendar as p (p.id)}
				<p class="type-caption nocal-row">
					No calendar for {p.name} yet
					<button
						type="button"
						class="mklocal"
						onclick={() => {
							localName = `${p.name}'s calendar`;
							localProfileId = p.id;
						}}
					>
						Create a local calendar
					</button>
				</p>
			{/each}
		</div>
	{/if}

	<div class="head">
		<p class="type-label"><CalendarPlus size={16} /> Local calendars</p>
	</div>
	<p class="type-caption sub">
		No external source needed — events created here on the display (or via the phone quick-add)
		are filed under one of these. Used automatically when a profile has no synced calendar.
	</p>

	{#each family.localCalendars as c (c.id)}
		<div class="cal">
			<span
				class="dot"
				style:background={c.profileId
					? profileColorVar(family.profile(c.profileId)?.color ?? 'sky')
					: 'var(--color-text-tertiary)'}
			></span>
			<span class="cname type-label">{c.name}</span>
			<span class="chost type-caption"
				>{c.profileId ? (family.profile(c.profileId)?.name ?? 'Unassigned') : 'Whole family'}</span
			>
			{#if c.id !== 1}
				<button type="button" class="del" aria-label="Remove" onclick={() => removeLocal(c.id)}>
					<X size={14} />
				</button>
			{/if}
		</div>
	{/each}

	<div class="addform">
		<div class="row2">
			<input class="in name" type="text" placeholder="Calendar name" bind:value={localName} />
			<select class="in sel" bind:value={localProfileId}>
				<option value="">Whole family</option>
				{#each family.profiles as p (p.id)}
					<option value={p.id}>{p.name}</option>
				{/each}
			</select>
			<button type="button" class="add" disabled={!localName.trim()} onclick={addLocal}>
				<Plus size={16} /> Add
			</button>
		</div>
	</div>
	{#if localMsg}<p class="type-caption msg">{localMsg}</p>{/if}
</div>

<style>
	.cl {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.head .type-label {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.refresh {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border-radius: var(--radius-pill);
		color: var(--color-text-secondary);
		background: var(--color-surface-elevated);
	}
	.sub {
		color: var(--color-text-tertiary);
	}
	.cal {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: 8px 10px;
		border-radius: var(--radius-md);
		background: var(--color-surface-elevated);
	}
	.dot {
		width: 12px;
		height: 12px;
		border-radius: var(--radius-pill);
		flex: none;
	}
	.cname {
		color: var(--color-text-primary);
	}
	.chost {
		color: var(--color-text-tertiary);
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.del {
		display: grid;
		place-items: center;
		width: 26px;
		height: 26px;
		border-radius: var(--radius-pill);
		color: var(--color-text-tertiary);
		flex: none;
	}
	.del:hover {
		color: var(--color-accent-warning);
	}
	.addform {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.row2 {
		display: flex;
		gap: var(--space-2);
		flex-wrap: wrap;
	}
	.in {
		padding: 9px 12px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-border-subtle);
		background: var(--color-surface);
		color: var(--color-text-primary);
	}
	.addform > .in {
		width: 100%;
	}
	.name {
		flex: 1;
		min-width: 120px;
	}
	.sel {
		flex: 0 0 auto;
	}
	.add {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 0 14px;
		border-radius: var(--radius-pill);
		background: var(--color-text-primary);
		color: var(--color-surface);
		font-weight: var(--weight-semibold);
	}
	.add:disabled {
		opacity: 0.45;
	}
	.msg {
		color: var(--color-text-secondary);
	}
	.nocal {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-3);
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--color-accent-warning) 12%, var(--color-surface));
	}
	.nocal-row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--color-text-secondary);
	}
	.mklocal {
		font-weight: var(--weight-semibold);
		color: var(--color-text-primary);
		text-decoration: underline;
	}
</style>
