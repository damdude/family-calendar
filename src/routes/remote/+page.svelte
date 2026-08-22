<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { mirror } from '$lib/stores/mirror.svelte';
	import { profileColorVar, profileTint, PROFILE_COLORS } from '$lib/design/colors';
	import { AVATAR_CHOICES } from '$lib/setup/types';
	import { formatRange } from '$lib/time';
	import Avatar from '$lib/components/Avatar.svelte';
	import {
		Check,
		Plus,
		Smartphone,
		CalendarDays,
		ListChecks,
		SquareCheck,
		Settings,
		Trash2,
		Search,
		Pencil,
		X
	} from 'lucide-svelte';
	import type { ProfileColor } from '$lib/types';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	onMount(() => {
		// Identity for the heartbeat in the root layout — this device stays
		// right here, it doesn't drive the TV's navigation anymore.
		mirror.becomeController(data.token);
	});

	let stopped = $state(false);
	type Tab = 'calendar' | 'lists' | 'tasks' | 'settings';
	let tab = $state<Tab>('calendar');

	// The display follows whichever tab is active here (not a full mirror —
	// just which top-level section to show), so an edit made from the phone
	// is visible on the TV right away without switching it by hand.
	const TAB_PATH: Record<Tab, string> = {
		calendar: '/',
		lists: '/lists',
		tasks: '/tasks',
		settings: '/settings'
	};
	$effect(() => {
		mirror.activePath = TAB_PATH[tab];
	});

	function done() {
		mirror.stop();
		stopped = true;
	}

	// --- Calendar: add event ---
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
	let savingEvent = $state(false);
	let eventAdded = $state(false);
	let eventError = $state('');

	function toggleProfile(id: number) {
		profileIds = profileIds.includes(id) ? profileIds.filter((x) => x !== id) : [...profileIds, id];
	}
	function ts(d: string, t: string): number {
		const [y, m, day] = d.split('-').map(Number);
		const [hh, mm] = t.split(':').map(Number);
		return Math.floor(new Date(y, m - 1, day, hh, mm).getTime() / 1000);
	}

	async function addEvent() {
		if (!title.trim()) {
			eventError = 'Add a title.';
			return;
		}
		savingEvent = true;
		eventError = '';
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
				eventAdded = true;
				title = '';
				location = '';
				profileIds = [];
				await invalidateAll(); // pull the fresh event into "What's coming up"
				setTimeout(() => (eventAdded = false), 2500);
			} else {
				eventError = (await r.json().catch(() => ({})))?.message ?? 'Could not add.';
			}
		} finally {
			savingEvent = false;
		}
	}

	// --- Calendar: "What's coming up" grouping ---
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

	// --- Lists ---
	let newItemText = $state<Record<number, string>>({});
	let listBusy = $state<number | null>(null);

	async function toggleItem(listId: number, itemId: number) {
		try {
			await fetch('/api/mirror/list-item-toggle', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ token: data.token, listId, itemId })
			});
		} finally {
			await invalidateAll();
		}
	}
	async function addItem(listId: number) {
		const text = (newItemText[listId] ?? '').trim();
		if (!text) return;
		listBusy = listId;
		try {
			await fetch('/api/mirror/list-item', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ token: data.token, listId, text })
			});
			newItemText[listId] = '';
			await invalidateAll();
		} finally {
			listBusy = null;
		}
	}

	// --- Tasks ---
	let newTaskText = $state('');
	let taskProfileId = $state<number | ''>('');
	let savingTask = $state(false);

	async function toggleTask(id: number) {
		try {
			await fetch('/api/mirror/task-toggle', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ token: data.token, id })
			});
		} finally {
			await invalidateAll();
		}
	}
	async function addTask() {
		const text = newTaskText.trim();
		if (!text) return;
		savingTask = true;
		try {
			await fetch('/api/mirror/task', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					token: data.token,
					text,
					profileId: taskProfileId === '' ? undefined : Number(taskProfileId)
				})
			});
			newTaskText = '';
			taskProfileId = '';
			await invalidateAll();
		} finally {
			savingTask = false;
		}
	}
	const openTasks = $derived(data.tasks.filter((t) => !t.done));
	const doneTasks = $derived(data.tasks.filter((t) => t.done));
	function profileName(id?: number) {
		return id ? (data.profiles.find((p) => p.id === id)?.name ?? '') : '';
	}

	// --- Settings: family name ---
	let familyNameInput = $state(data.familyName ?? '');
	let savingName = $state(false);
	async function saveFamilyName() {
		const name = familyNameInput.trim();
		if (!name || name === data.familyName) return;
		savingName = true;
		try {
			await fetch('/api/mirror/settings', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ token: data.token, familyName: name })
			});
			await invalidateAll();
		} finally {
			savingName = false;
		}
	}

	// --- Settings: display (sleep window, idle screensaver, clock format) ---
	let sleepStartInput = $state(data.sleepStart ?? '21:00');
	let sleepEndInput = $state(data.sleepEnd ?? '06:30');
	let sleepEnabledInput = $state(data.sleepEnabled ?? true);
	let idleMinutesInput = $state(data.idleMinutes ?? 10);
	let clock24hInput = $state(data.clock24h ?? false);
	let savingDisplay = $state(false);
	let displaySaved = $state(false);
	async function saveDisplaySettings() {
		savingDisplay = true;
		try {
			await fetch('/api/mirror/app-settings', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					token: data.token,
					sleepStart: sleepStartInput,
					sleepEnd: sleepEndInput,
					sleepEnabled: sleepEnabledInput,
					idleMinutes: Number(idleMinutesInput),
					clock24h: clock24hInput
				})
			});
			displaySaved = true;
			await invalidateAll();
			setTimeout(() => (displaySaved = false), 2500);
		} finally {
			savingDisplay = false;
		}
	}

	// --- Settings: location (also sets timezone from the same pick) ---
	interface LocResult {
		name: string;
		admin1?: string;
		country?: string;
		latitude: number;
		longitude: number;
		timezone: string;
	}
	let locQuery = $state('');
	let locResults = $state<LocResult[]>([]);
	let locSearching = $state(false);
	let locError = $state('');
	let locSaved = $state(false);
	let locSearchToken = 0;

	async function searchLocation() {
		const q = locQuery.trim();
		if (q.length < 2) {
			locResults = [];
			return;
		}
		const myToken = ++locSearchToken;
		locSearching = true;
		locError = '';
		try {
			const r = await fetch(`/api/location-search?q=${encodeURIComponent(q)}`);
			if (myToken !== locSearchToken) return; // a newer search superseded this one
			if (r.ok) locResults = (await r.json()).results;
			else locError = 'Search failed.';
		} catch {
			if (myToken === locSearchToken) locError = 'Search failed — check the device is online.';
		} finally {
			if (myToken === locSearchToken) locSearching = false;
		}
	}
	let locSearchDebounce: ReturnType<typeof setTimeout>;
	function onLocInput() {
		clearTimeout(locSearchDebounce);
		locSearchDebounce = setTimeout(searchLocation, 400);
	}

	async function pickLocation(r: LocResult) {
		locResults = [];
		locQuery = `${r.name}${r.admin1 ? ', ' + r.admin1 : ''}`;
		await fetch('/api/mirror/settings', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				token: data.token,
				latitude: r.latitude,
				longitude: r.longitude,
				timezone: r.timezone
			})
		});
		locSaved = true;
		await invalidateAll();
		setTimeout(() => (locSaved = false), 2500);
	}

	// --- Settings: people ---
	let editingProfileId = $state<number | null>(null);
	let addingProfile = $state(false);
	let profName = $state('');
	let profAge = $state<number | ''>('');
	let profColor = $state<ProfileColor>('pink');
	let profAvatar = $state<string>(AVATAR_CHOICES[0]);
	let savingProfile = $state(false);
	let profileFormError = $state('');

	function startNewProfile() {
		editingProfileId = null;
		addingProfile = true;
		profName = '';
		profAge = '';
		profColor = 'pink';
		profAvatar = AVATAR_CHOICES[0];
		profileFormError = '';
	}
	function startEditProfile(p: PageData['profiles'][number]) {
		editingProfileId = p.id;
		addingProfile = true;
		profName = p.name;
		profAge = p.age;
		profColor = p.color as ProfileColor;
		profAvatar = p.avatarEmoji;
		profileFormError = '';
	}
	function cancelProfileForm() {
		addingProfile = false;
		editingProfileId = null;
	}
	async function saveProfile() {
		const name = profName.trim();
		if (!name || profAge === '') {
			profileFormError = 'Add a name and age.';
			return;
		}
		savingProfile = true;
		profileFormError = '';
		try {
			const r = await fetch('/api/mirror/profile', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					token: data.token,
					id: editingProfileId ?? undefined,
					name,
					age: Number(profAge),
					color: profColor,
					avatarEmoji: profAvatar
				})
			});
			if (r.ok) {
				addingProfile = false;
				editingProfileId = null;
				await invalidateAll();
			} else {
				profileFormError = 'Could not save.';
			}
		} finally {
			savingProfile = false;
		}
	}
	async function removeProfile(id: number) {
		await fetch('/api/mirror/profile-remove', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ token: data.token, id })
		});
		if (editingProfileId === id) cancelProfileForm();
		await invalidateAll();
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
				<h1 class="type-title">Family Calendar</h1>
			</div>
			<button type="button" class="done" onclick={done}>Done</button>
		</header>
		<p class="live type-caption"><Smartphone size={13} /> Live — shows up on the display right away</p>

		<nav class="tabs">
			<button type="button" class="tab" class:on={tab === 'calendar'} onclick={() => (tab = 'calendar')}>
				<CalendarDays size={16} /> Calendar
			</button>
			<button type="button" class="tab" class:on={tab === 'lists'} onclick={() => (tab = 'lists')}>
				<ListChecks size={16} /> Lists
			</button>
			<button type="button" class="tab" class:on={tab === 'tasks'} onclick={() => (tab = 'tasks')}>
				<SquareCheck size={16} /> Tasks
			</button>
			<button type="button" class="tab" class:on={tab === 'settings'} onclick={() => (tab = 'settings')}>
				<Settings size={16} /> Settings
			</button>
		</nav>

		{#if tab === 'calendar'}
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
									onclick={() => toggleProfile(p.id)}>{p.avatarEmoji} {p.name}</button
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

				{#if eventError}<p class="type-caption err">{eventError}</p>{/if}
				<button type="button" class="btn primary" disabled={savingEvent} onclick={addEvent}>
					{#if eventAdded}<Check size={18} /> Added{:else}<Plus size={18} />{savingEvent
							? 'Adding…'
							: 'Add event'}{/if}
				</button>
			</section>

			<h2 class="type-label section-h">What's coming up</h2>
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
										{e.allDay
											? 'All day'
											: formatRange(new Date(e.startTs * 1000), new Date(e.endTs * 1000))}
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
		{/if}

		{#if tab === 'lists'}
			{#if data.lists.length === 0}
				<p class="type-body sub empty">No lists yet — create one on the display.</p>
			{:else}
				{#each data.lists as list (list.id)}
					<section class="card">
						<h2 class="type-label listname"><span>{list.icon}</span> {list.name}</h2>
						{#if list.items.length === 0}
							<p class="type-caption sub">Nothing on this list yet.</p>
						{:else}
							<div class="items">
								{#each list.items as item (item.id)}
									<button
										type="button"
										class="itemrow"
										class:done={item.completed}
										onclick={() => toggleItem(list.id, item.id)}
									>
										<span class="check" class:on={item.completed}
											>{#if item.completed}<Check size={14} strokeWidth={3} />{/if}</span
										>
										<span class="itext type-body">{item.text}</span>
									</button>
								{/each}
							</div>
						{/if}
						<div class="addrow">
							<input
								class="in"
								type="text"
								placeholder="Add an item"
								bind:value={newItemText[list.id]}
								onkeydown={(e) => e.key === 'Enter' && addItem(list.id)}
							/>
							<button
								type="button"
								class="addbtn"
								disabled={listBusy === list.id}
								onclick={() => addItem(list.id)}><Plus size={18} /></button
							>
						</div>
					</section>
				{/each}
			{/if}
		{/if}

		{#if tab === 'tasks'}
			<section class="card">
				<label class="field">
					<span class="type-label lbl">New task</span>
					<input
						class="in"
						type="text"
						placeholder="e.g. Pack swim bag"
						bind:value={newTaskText}
						maxlength="200"
						onkeydown={(e) => e.key === 'Enter' && addTask()}
					/>
				</label>
				{#if data.profiles.length}
					<div class="field">
						<span class="type-label lbl">For (optional)</span>
						<div class="chips">
							<button
								type="button"
								class="chip"
								class:on={taskProfileId === ''}
								onclick={() => (taskProfileId = '')}>Anyone</button
							>
							{#each data.profiles as p (p.id)}
								<button
									type="button"
									class="chip"
									class:on={taskProfileId === p.id}
									style:background={taskProfileId === p.id ? profileTint(p.color, 45) : ''}
									style:box-shadow={taskProfileId === p.id
										? `inset 0 0 0 2px ${profileColorVar(p.color)}`
										: ''}
									onclick={() => (taskProfileId = p.id)}>{p.avatarEmoji} {p.name}</button
								>
							{/each}
						</div>
					</div>
				{/if}
				<button type="button" class="btn primary" disabled={savingTask} onclick={addTask}>
					<Plus size={18} />{savingTask ? 'Adding…' : 'Add task'}
				</button>
			</section>

			{#if openTasks.length === 0 && doneTasks.length === 0}
				<p class="type-body sub empty">No tasks yet.</p>
			{:else}
				<section class="card">
					{#if openTasks.length}
						<div class="items">
							{#each openTasks as t (t.id)}
								<button type="button" class="itemrow" onclick={() => toggleTask(t.id)}>
									<span class="check"></span>
									<span class="itext type-body">{t.text}</span>
									{#if t.profileId}<span class="tfor type-caption">{profileName(t.profileId)}</span
										>{/if}
								</button>
							{/each}
						</div>
					{/if}
					{#if doneTasks.length}
						<p class="type-caption glabel donelabel">Done</p>
						<div class="items">
							{#each doneTasks as t (t.id)}
								<button type="button" class="itemrow done" onclick={() => toggleTask(t.id)}>
									<span class="check on"><Check size={14} strokeWidth={3} /></span>
									<span class="itext type-body">{t.text}</span>
								</button>
							{/each}
						</div>
					{/if}
				</section>
			{/if}
		{/if}

		{#if tab === 'settings'}
			<section class="card">
				<h2 class="type-label sec-h">Family name</h2>
				<div class="row">
					<input class="in grow" type="text" bind:value={familyNameInput} maxlength="60" />
					<button
						type="button"
						class="btn primary small"
						disabled={savingName || !familyNameInput.trim() || familyNameInput.trim() === data.familyName}
						onclick={saveFamilyName}
					>
						{savingName ? 'Saving…' : 'Save'}
					</button>
				</div>
			</section>

			<section class="card">
				<h2 class="type-label sec-h">Display</h2>
				<div class="field">
					<span class="type-label lbl">Clock</span>
					<div class="chips">
						<button
							type="button"
							class="chip"
							class:on={!clock24hInput}
							onclick={() => (clock24hInput = false)}>12-hour</button
						>
						<button
							type="button"
							class="chip"
							class:on={clock24hInput}
							onclick={() => (clock24hInput = true)}>24-hour</button
						>
					</div>
				</div>
				<div class="row">
					<label class="field allday">
						<span class="type-label lbl">Sleep window</span>
						<button
							type="button"
							class="switch"
							class:on={sleepEnabledInput}
							role="switch"
							aria-checked={sleepEnabledInput}
							aria-label="Sleep window"
							onclick={() => (sleepEnabledInput = !sleepEnabledInput)}><span class="knob"
							></span></button
						>
					</label>
				</div>
				{#if sleepEnabledInput}
					<div class="row">
						<label class="field grow">
							<span class="type-label lbl">Sleeps at</span>
							<input class="in" type="time" bind:value={sleepStartInput} />
						</label>
						<label class="field grow">
							<span class="type-label lbl">Wakes at</span>
							<input class="in" type="time" bind:value={sleepEndInput} />
						</label>
					</div>
				{/if}
				<label class="field">
					<span class="type-label lbl">Screensaver after (minutes of inactivity, 0 = only during sleep)</span>
					<input class="in" type="number" min="0" max="120" bind:value={idleMinutesInput} />
				</label>
				<button type="button" class="btn primary" disabled={savingDisplay} onclick={saveDisplaySettings}>
					{#if displaySaved}<Check size={18} /> Saved{:else}{savingDisplay ? 'Saving…' : 'Save'}{/if}
				</button>
			</section>

			<section class="card">
				<h2 class="type-label sec-h">Location</h2>
				<p class="type-caption sub">
					Sets the display's timezone and drives sunrise/sunset (for auto dark mode).
				</p>
				<div class="field">
					<input
						class="in"
						type="text"
						placeholder="Search for a city…"
						bind:value={locQuery}
						oninput={onLocInput}
					/>
				</div>
				{#if locSearching}
					<p class="type-caption sub"><Search size={14} /> Searching…</p>
				{:else if locError}
					<p class="type-caption err">{locError}</p>
				{:else if locResults.length}
					<div class="items">
						{#each locResults as r (r.latitude + ',' + r.longitude)}
							<button type="button" class="itemrow" onclick={() => pickLocation(r)}>
								<span class="itext type-body"
									>{r.name}{r.admin1 ? `, ${r.admin1}` : ''}{r.country ? `, ${r.country}` : ''}</span
								>
								<span class="tfor type-caption">{r.timezone}</span>
							</button>
						{/each}
					</div>
				{/if}
				{#if locSaved}
					<p class="type-caption saved-msg"><Check size={14} strokeWidth={3} /> Location saved</p>
				{:else if data.latitude !== undefined && data.longitude !== undefined}
					<p class="type-caption sub">
						Current: {data.latitude.toFixed(2)}, {data.longitude.toFixed(2)} ({data.timezone})
					</p>
				{/if}
			</section>

			<section class="card">
				<div class="sec-head">
					<h2 class="type-label sec-h">People</h2>
					{#if !addingProfile}
						<button type="button" class="addbtn small" onclick={startNewProfile}
							><Plus size={16} /></button
						>
					{/if}
				</div>
				<div class="items">
					{#each data.profiles as p (p.id)}
						<div class="itemrow proflink">
							<Avatar profile={p} size={28} ring={false} />
							<span class="itext type-body">{p.name} · {p.age}</span>
							<button
								type="button"
								class="iconbtn"
								aria-label="Edit {p.name}"
								onclick={() => startEditProfile(p)}><Pencil size={15} /></button
							>
							<button
								type="button"
								class="iconbtn danger"
								aria-label="Remove {p.name}"
								onclick={() => removeProfile(p.id)}><Trash2 size={15} /></button
							>
						</div>
					{/each}
				</div>

				{#if addingProfile}
					<div class="profform">
						<div class="sec-head">
							<h3 class="type-label sec-h">{editingProfileId ? 'Edit person' : 'New person'}</h3>
							<button type="button" class="iconbtn" aria-label="Cancel" onclick={cancelProfileForm}
								><X size={16} /></button
							>
						</div>
						<div class="row">
							<label class="field grow">
								<span class="type-label lbl">Name</span>
								<input class="in" type="text" bind:value={profName} maxlength="40" />
							</label>
							<label class="field">
								<span class="type-label lbl">Age</span>
								<input class="in agein" type="number" min="0" max="120" bind:value={profAge} />
							</label>
						</div>
						<div class="field">
							<span class="type-label lbl">Color</span>
							<div class="chips">
								{#each PROFILE_COLORS as c (c)}
									<button
										type="button"
										class="colordot"
										class:on={profColor === c}
										style:background={profileColorVar(c)}
										aria-label={c}
										onclick={() => (profColor = c)}
									></button>
								{/each}
							</div>
						</div>
						<div class="field">
							<span class="type-label lbl">Avatar</span>
							<div class="chips">
								{#each AVATAR_CHOICES as a (a)}
									<button
										type="button"
										class="emojidot"
										class:on={profAvatar === a}
										onclick={() => (profAvatar = a)}>{a}</button
									>
								{/each}
							</div>
						</div>
						{#if profileFormError}<p class="type-caption err">{profileFormError}</p>{/if}
						<button type="button" class="btn primary" disabled={savingProfile} onclick={saveProfile}>
							{savingProfile ? 'Saving…' : 'Save'}
						</button>
					</div>
				{/if}
			</section>
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
	.tabs {
		display: flex;
		gap: var(--space-2);
		background: var(--color-surface-elevated);
		padding: 4px;
		border-radius: var(--radius-pill);
	}
	.tab {
		flex: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 9px 10px;
		border-radius: var(--radius-pill);
		color: var(--color-text-secondary);
		font-weight: var(--weight-semibold);
		font-size: var(--text-sm);
	}
	.tab.on {
		background: var(--color-surface);
		color: var(--color-text-primary);
		box-shadow: var(--shadow-card);
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
	.section-h {
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
	.listname {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--color-text-primary);
	}
	.items {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.itemrow {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: 10px;
		border-radius: var(--radius-md);
		background: var(--color-surface-elevated);
		text-align: left;
	}
	.check {
		flex: none;
		width: 22px;
		height: 22px;
		border-radius: var(--radius-sm);
		border: 2px solid var(--color-border-subtle);
		display: grid;
		place-items: center;
		color: var(--color-surface);
	}
	.check.on {
		background: var(--color-accent-success);
		border-color: var(--color-accent-success);
	}
	.itext {
		flex: 1;
		color: var(--color-text-primary);
	}
	.itemrow.done .itext {
		color: var(--color-text-tertiary);
		text-decoration: line-through;
	}
	.tfor {
		flex: none;
		color: var(--color-text-tertiary);
	}
	.donelabel {
		margin-top: var(--space-2);
	}
	.addrow {
		display: flex;
		gap: var(--space-2);
	}
	.addrow .in {
		flex: 1;
	}
	.addbtn {
		display: grid;
		place-items: center;
		width: 48px;
		border-radius: var(--radius-md);
		background: var(--color-text-primary);
		color: var(--color-surface);
		flex: none;
	}
	.addbtn:disabled {
		opacity: 0.6;
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
	.sec-h {
		color: var(--color-text-secondary);
	}
	.sec-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.saved-msg {
		display: flex;
		align-items: center;
		gap: 4px;
		color: var(--color-accent-success);
	}
	.btn.small {
		padding: 11px 16px;
		font-size: var(--text-base);
	}
	.btn.primary:disabled {
		opacity: 0.5;
	}
	.addbtn.small {
		width: 40px;
		height: 40px;
		border-radius: var(--radius-pill);
	}
	.proflink {
		gap: var(--space-3);
	}
	.iconbtn {
		display: grid;
		place-items: center;
		width: 34px;
		height: 34px;
		border-radius: var(--radius-pill);
		background: var(--color-surface);
		color: var(--color-text-secondary);
		flex: none;
	}
	.iconbtn.danger:active {
		color: var(--color-accent-warning);
	}
	.profform {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding-top: var(--space-3);
		border-top: 1px solid var(--color-border-subtle);
	}
	.agein {
		width: 80px;
	}
	.colordot {
		width: 34px;
		height: 34px;
		border-radius: var(--radius-pill);
		flex: none;
	}
	.colordot.on {
		box-shadow: 0 0 0 3px var(--color-surface), 0 0 0 5px var(--color-text-primary);
	}
	.emojidot {
		width: 40px;
		height: 40px;
		display: grid;
		place-items: center;
		font-size: 1.3rem;
		border-radius: var(--radius-pill);
		background: var(--color-surface-elevated);
		flex: none;
	}
	.emojidot.on {
		box-shadow: inset 0 0 0 2px var(--color-text-primary);
	}
</style>
