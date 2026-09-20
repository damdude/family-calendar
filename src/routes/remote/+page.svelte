<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { mirror } from '$lib/stores/mirror.svelte';
	import { profileColorVar, profileTint } from '$lib/design/colors';
	import { autoEmojiFor } from '$lib/meals';
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
		Pencil,
		X,
		UtensilsCrossed,
		BookOpen,
		Sparkles,
		Gift,
		Star,
		RotateCcw
	} from 'lucide-svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	onMount(() => {
		// Identity for the heartbeat in the root layout — this device stays
		// right here, it doesn't drive the TV's navigation anymore.
		mirror.becomeController(data.token);
	});

	let stopped = $state(false);
	type Tab = 'calendar' | 'lists' | 'tasks' | 'meals' | 'recipes' | 'routines' | 'rewards';
	let tab = $state<Tab>('calendar');

	// The display follows whichever tab is active here (not a full mirror —
	// just which top-level section to show), so an edit made from the phone
	// is visible on the TV right away without switching it by hand.
	const TAB_PATH: Record<Tab, string> = {
		calendar: '/',
		lists: '/lists',
		tasks: '/tasks',
		recipes: '/recipes',
		meals: '/meals',
		routines: '/routines',
		rewards: '/rewards'
	};
	$effect(() => {
		mirror.activePath = TAB_PATH[tab];
	});

	function done() {
		mirror.stop();
		stopped = true;
	}

	// --- Calendar: add/edit event ---
	// Local events are offset by this on the server (src/routes/remote/+page.server.ts)
	// so they never collide with synced-calendar ids in the merged agenda list.
	// Only ids at/above this offset are ours to edit or delete.
	const LOCAL_ID_BASE = 1_000_000;
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
	// null = adding a new local event. Otherwise the raw id (no LOCAL_ID_BASE
	// offset) plus which kind it is — local events are fully ours (title
	// included); synced events can have time/location/who edited here (an
	// override this app keeps showing instead of the source's own values —
	// there's no write-back to an ICS subscription, see the synced-event
	// endpoint), but not the title.
	let editingEvent = $state<{ kind: 'local' | 'synced'; id: number } | null>(null);

	function toggleProfile(id: number) {
		profileIds = profileIds.includes(id) ? profileIds.filter((x) => x !== id) : [...profileIds, id];
	}
	function ts(d: string, t: string): number {
		const [y, m, day] = d.split('-').map(Number);
		const [hh, mm] = t.split(':').map(Number);
		return Math.floor(new Date(y, m - 1, day, hh, mm).getTime() / 1000);
	}
	function fromTs(t: number): { date: string; time: string } {
		const d = new Date(t * 1000);
		return {
			date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
			time: `${pad(d.getHours())}:${pad(d.getMinutes())}`
		};
	}

	function editEvent(e: PageData['events'][number]) {
		editingEvent =
			e.id < LOCAL_ID_BASE
				? { kind: 'synced', id: e.id }
				: { kind: 'local', id: e.id - LOCAL_ID_BASE };
		title = e.title;
		allDay = e.allDay;
		const s = fromTs(e.startTs);
		const en = fromTs(e.endTs);
		date = s.date;
		startTime = s.time;
		endTime = en.time;
		location = e.location ?? '';
		profileIds = [...e.profileIds];
		eventError = '';
	}
	function cancelEventForm() {
		editingEvent = null;
		title = '';
		location = '';
		profileIds = [];
		allDay = false;
		date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
		startTime = `${pad(now.getHours())}:00`;
		endTime = `${pad(now.getHours() + 1)}:00`;
		eventError = '';
	}

	async function addEvent() {
		const isSynced = editingEvent?.kind === 'synced';
		if (!isSynced && !title.trim()) {
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
			const r = await fetch(isSynced ? '/api/mirror/synced-event' : '/api/mirror/event', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					token: data.token,
					id: isSynced ? editingEvent!.id : (editingEvent?.id ?? undefined),
					...(isSynced ? {} : { title: title.trim() }),
					startTs,
					endTs,
					allDay,
					location: location.trim() || undefined,
					profileIds
				})
			});
			if (r.ok) {
				const wasEdit = editingEvent !== null;
				eventAdded = true;
				cancelEventForm();
				await invalidateAll(); // pull the fresh event into "What's coming up"
				if (!wasEdit) setTimeout(() => (eventAdded = false), 2500);
				else eventAdded = false;
			} else {
				eventError = (await r.json().catch(() => ({})))?.message ?? 'Could not save.';
			}
		} finally {
			savingEvent = false;
		}
	}

	/** Local events: delete outright. Synced events: drop the local override
	 *  and revert to whatever the source calendar itself currently says. */
	async function removeEvent() {
		if (!editingEvent) return;
		savingEvent = true;
		try {
			await fetch(
				editingEvent.kind === 'synced'
					? '/api/mirror/synced-event-reset'
					: '/api/mirror/event-remove',
				{
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ token: data.token, id: editingEvent.id })
				}
			);
			cancelEventForm();
			await invalidateAll();
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

	const LIST_KIND_ICON: Record<'grocery' | 'todo' | 'packing' | 'custom', string> = {
		grocery: '🛒',
		todo: '✅',
		packing: '🧳',
		custom: '📋'
	};
	let newListOpen = $state(false);
	let newListName = $state('');
	let newListKind = $state<'grocery' | 'todo' | 'packing' | 'custom'>('todo');
	let savingList = $state(false);
	async function createList() {
		const name = newListName.trim();
		if (!name) return;
		savingList = true;
		try {
			await fetch('/api/mirror/list', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					token: data.token,
					name,
					kind: newListKind,
					icon: LIST_KIND_ICON[newListKind]
				})
			});
			newListName = '';
			newListKind = 'todo';
			newListOpen = false;
			await invalidateAll();
		} finally {
			savingList = false;
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
	async function removeTask(id: number) {
		try {
			await fetch('/api/mirror/task-remove', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ token: data.token, id })
			});
		} finally {
			await invalidateAll();
		}
	}
	const openTasks = $derived(data.tasks.filter((t) => !t.done));
	const doneTasks = $derived(data.tasks.filter((t) => t.done));
	function profileName(id?: number) {
		return id ? (data.profiles.find((p) => p.id === id)?.name ?? '') : '';
	}

	// --- Meals ---
	type MealType = 'breakfast' | 'lunch' | 'dinner';
	const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner'];
	const MEAL_LABEL: Record<MealType, string> = {
		breakfast: 'Breakfast',
		lunch: 'Lunch',
		dinner: 'Dinner'
	};

	function ymd(d: Date): string {
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}
	const mealDays = $derived.by(() => {
		const out: { key: string; label: string }[] = [];
		const base = new Date();
		for (let i = 0; i < 7; i++) {
			const d = new Date(base);
			d.setDate(d.getDate() + i);
			out.push({ key: ymd(d), label: dayLabel(Math.floor(d.getTime() / 1000)) });
		}
		return out;
	});
	function mealAt(dateKey: string, type: MealType) {
		return data.meals.find((m) => m.date === dateKey && m.mealType === type);
	}

	let editingMeal = $state<{ date: string; type: MealType } | null>(null);
	let mealDraft = $state('');
	let savingMeal = $state(false);

	function openMealEditor(dateKey: string, type: MealType) {
		editingMeal = { date: dateKey, type };
		mealDraft = mealAt(dateKey, type)?.name ?? '';
	}
	function closeMealEditor() {
		editingMeal = null;
		mealDraft = '';
	}
	async function saveMeal() {
		if (!editingMeal) return;
		savingMeal = true;
		try {
			await fetch('/api/mirror/meal', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					token: data.token,
					date: editingMeal.date,
					mealType: editingMeal.type,
					name: mealDraft.trim(),
					emoji: autoEmojiFor(mealDraft.trim())
				})
			});
			closeMealEditor();
			await invalidateAll();
		} finally {
			savingMeal = false;
		}
	}
	async function clearMeal() {
		if (!editingMeal) return;
		mealDraft = '';
		await saveMeal();
	}

	// --- Recipes ---
	let addingRecipe = $state(false);
	let recipeName = $state('');
	let recipeIngredients = $state('');
	let recipeSteps = $state('');
	let savingRecipe = $state(false);
	let recipeFormError = $state('');
	let expandedRecipeId = $state<number | null>(null);

	function startNewRecipe() {
		addingRecipe = true;
		recipeName = '';
		recipeIngredients = '';
		recipeSteps = '';
		recipeFormError = '';
	}
	function cancelRecipeForm() {
		addingRecipe = false;
	}
	async function saveRecipe() {
		const name = recipeName.trim();
		const ingredients = recipeIngredients
			.split('\n')
			.map((s) => s.trim())
			.filter(Boolean);
		const steps = recipeSteps
			.split('\n')
			.map((s) => s.trim())
			.filter(Boolean);
		if (!name || ingredients.length === 0 || steps.length === 0) {
			recipeFormError = 'Add a name, at least one ingredient, and at least one step.';
			return;
		}
		savingRecipe = true;
		recipeFormError = '';
		try {
			const r = await fetch('/api/mirror/recipe', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					token: data.token,
					name,
					emoji: autoEmojiFor(name),
					ingredients,
					steps
				})
			});
			if (r.ok) {
				addingRecipe = false;
				await invalidateAll();
			} else {
				recipeFormError = 'Could not save.';
			}
		} finally {
			savingRecipe = false;
		}
	}
	async function removeRecipeItem(id: number) {
		await fetch('/api/mirror/recipe-remove', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ token: data.token, id })
		});
		if (expandedRecipeId === id) expandedRecipeId = null;
		await invalidateAll();
	}

	// --- Routines ---
	function starsFor(profileId: number): number {
		return data.stars.find((s) => s.profileId === profileId)?.stars ?? 0;
	}
	// A kid tapping through a checklist fires several toggles in quick
	// succession — each one waiting on `data` (only refreshed by a full
	// invalidateAll round trip) to compute its new step list would read the
	// same stale snapshot and clobber the others, silently dropping all but
	// the last tap. This local overlay is the accumulating source of truth
	// for in-flight taps instead; it's only cleared once the routine
	// actually completes, since that's the one moment streak/stars also need
	// a real refresh anyway.
	let routineOverrides = $state<Record<number, number[]>>({});
	function doneStepsFor(routine: PageData['routines'][number]): number[] {
		return routineOverrides[routine.id] ?? routine.doneStepIds;
	}
	async function toggleRoutineStep(routine: PageData['routines'][number], stepId: number) {
		const current = doneStepsFor(routine);
		const doneStepIds = current.includes(stepId)
			? current.filter((id) => id !== stepId)
			: [...current, stepId];
		routineOverrides[routine.id] = doneStepIds;
		try {
			const r = await fetch(`/api/routine/${routine.id}`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					date: new Date().toISOString().slice(0, 10),
					doneStepIds,
					total: routine.steps.length,
					profileId: routine.profileId
				})
			});
			if (r.ok) {
				const p = await r.json();
				if (p.stars !== undefined) {
					// Just completed — refresh streak + star balance, and the
					// override can drop now that `data` will match it.
					await invalidateAll();
					delete routineOverrides[routine.id];
				}
			}
		} catch {
			/* offline; the override stays as the optimistic truth for now */
		}
	}
	const routinesByProfile = $derived.by(() => {
		const out: { profile: PageData['profiles'][number]; routines: PageData['routines'] }[] = [];
		for (const p of data.profiles) {
			const rs = data.routines.filter((r) => r.profileId === p.id);
			if (rs.length) out.push({ profile: p, routines: rs });
		}
		return out;
	});

	// --- Rewards ---
	let rewardsManaging = $state(false);
	let newRewardName = $state('');
	let newRewardIcon = $state('🎁');
	let newRewardCost = $state<number | ''>('');
	let savingReward = $state(false);
	let claimedToast = $state('');
	const rewardKids = $derived(data.profiles.filter((p) => p.role === 'child'));
	const activeRewards = $derived(
		[...data.rewards].filter((r) => r.active).sort((a, b) => a.starCost - b.starCost)
	);
	async function addReward() {
		if (!newRewardName.trim() || newRewardCost === '') return;
		savingReward = true;
		try {
			await fetch('/api/mirror/reward', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					token: data.token,
					name: newRewardName.trim(),
					icon: newRewardIcon,
					starCost: Number(newRewardCost)
				})
			});
			newRewardName = '';
			newRewardIcon = '🎁';
			newRewardCost = '';
			await invalidateAll();
		} finally {
			savingReward = false;
		}
	}
	async function toggleRewardActive(reward: PageData['rewards'][number]) {
		await fetch('/api/mirror/reward', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				token: data.token,
				id: reward.id,
				name: reward.name,
				icon: reward.icon,
				starCost: reward.starCost,
				active: !reward.active
			})
		});
		await invalidateAll();
	}
	async function removeReward(id: number) {
		await fetch('/api/mirror/reward-remove', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ token: data.token, id })
		});
		await invalidateAll();
	}
	async function claimReward(
		rewardId: number,
		profileId: number,
		kidName: string,
		rewardName: string
	) {
		const r = await fetch('/api/mirror/reward-claim', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ token: data.token, rewardId, profileId })
		});
		if (r.ok) {
			claimedToast = `${kidName} claimed ${rewardName}!`;
			setTimeout(() => (claimedToast = ''), 2600);
			await invalidateAll();
		}
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
		<p class="live type-caption">
			<Smartphone size={13} /> Live — shows up on the display right away
		</p>

		<nav class="tabs">
			<button
				type="button"
				class="tab"
				class:on={tab === 'calendar'}
				onclick={() => (tab = 'calendar')}
			>
				<CalendarDays size={16} /> Calendar
			</button>
			<button type="button" class="tab" class:on={tab === 'lists'} onclick={() => (tab = 'lists')}>
				<ListChecks size={16} /> Lists
			</button>
			<button type="button" class="tab" class:on={tab === 'tasks'} onclick={() => (tab = 'tasks')}>
				<SquareCheck size={16} /> Tasks
			</button>
			<button type="button" class="tab" class:on={tab === 'meals'} onclick={() => (tab = 'meals')}>
				<UtensilsCrossed size={16} /> Meals
			</button>
			<button
				type="button"
				class="tab"
				class:on={tab === 'recipes'}
				onclick={() => (tab = 'recipes')}
			>
				<BookOpen size={16} /> Recipes
			</button>
			{#if data.routines.length}
				<button
					type="button"
					class="tab"
					class:on={tab === 'routines'}
					onclick={() => (tab = 'routines')}
				>
					<Sparkles size={16} /> Routines
				</button>
			{/if}
			<button
				type="button"
				class="tab"
				class:on={tab === 'rewards'}
				onclick={() => (tab = 'rewards')}
			>
				<Gift size={16} /> Rewards
			</button>
			<a class="tab" href="/settings">
				<Settings size={16} /> Settings
			</a>
		</nav>

		{#if tab === 'calendar'}
			<section class="card">
				<div class="sec-head">
					<h3 class="type-label sec-h">
						{editingEvent === null ? 'New event' : 'Edit event'}
					</h3>
					{#if editingEvent !== null}
						<button type="button" class="iconbtn" aria-label="Cancel" onclick={cancelEventForm}
							><X size={16} /></button
						>
					{/if}
				</div>
				{#if editingEvent?.kind === 'synced'}
					<p class="type-body eventtitle-ro">{title}</p>
					<p class="type-caption sub">
						Synced from a calendar, so the name can't be changed here — but the time, location, and
						who it's for can. This won't change the event in the original calendar, only how it
						shows here.
					</p>
				{:else}
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
				{/if}

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
				<div class="row">
					<button type="button" class="btn primary grow" disabled={savingEvent} onclick={addEvent}>
						{#if eventAdded}<Check size={18} />
							{editingEvent !== null ? 'Saved' : 'Added'}{:else}<Plus size={18} />{savingEvent
								? 'Saving…'
								: editingEvent !== null
									? 'Save changes'
									: 'Add event'}{/if}
					</button>
					{#if editingEvent !== null}
						<button
							type="button"
							class="iconbtn danger"
							aria-label={editingEvent.kind === 'synced' ? 'Reset to calendar' : 'Delete event'}
							title={editingEvent.kind === 'synced' ? 'Reset to calendar' : 'Delete event'}
							disabled={savingEvent}
							onclick={removeEvent}
							>{#if editingEvent.kind === 'synced'}<RotateCcw size={16} />{:else}<Trash2
									size={16}
								/>{/if}</button
						>
					{/if}
				</div>
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
								<button type="button" class="erow editable" onclick={() => editEvent(e)}>
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
								</button>
							{/each}
						</div>
					{/each}
				</div>
			{/if}
		{/if}

		{#if tab === 'lists'}
			{#if data.lists.length === 0 && !newListOpen}
				<p class="type-body sub empty">No lists yet.</p>
			{/if}
			{#if !newListOpen}
				<button type="button" class="btn secondary" onclick={() => (newListOpen = true)}>
					<Plus size={16} /> New list
				</button>
			{:else}
				<section class="card">
					<div class="sec-head">
						<h3 class="type-label sec-h">New list</h3>
						<button
							type="button"
							class="iconbtn"
							aria-label="Cancel"
							onclick={() => (newListOpen = false)}><X size={16} /></button
						>
					</div>
					<label class="field">
						<span class="type-label lbl">Name</span>
						<input
							class="in"
							type="text"
							placeholder="e.g. Camping packing list"
							bind:value={newListName}
							maxlength="60"
							onkeydown={(e) => e.key === 'Enter' && createList()}
						/>
					</label>
					<div class="field">
						<span class="type-label lbl">Type</span>
						<div class="chips">
							{#each Object.entries(LIST_KIND_ICON) as [kind, icon] (kind)}
								<button
									type="button"
									class="chip"
									class:on={newListKind === kind}
									onclick={() => (newListKind = kind as typeof newListKind)}>{icon} {kind}</button
								>
							{/each}
						</div>
					</div>
					<button
						type="button"
						class="btn primary"
						disabled={!newListName.trim() || savingList}
						onclick={createList}
					>
						<Plus size={18} />{savingList ? 'Creating…' : 'Create list'}
					</button>
				</section>
			{/if}
			{#if data.lists.length > 0}
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
								<div class="itemrow taskrow">
									<button type="button" class="itemtoggle" onclick={() => toggleTask(t.id)}>
										<span class="check"></span>
										<span class="itext type-body">{t.text}</span>
										{#if t.profileId}<span class="tfor type-caption"
												>{profileName(t.profileId)}</span
											>{/if}
									</button>
									<button
										type="button"
										class="iconbtn danger"
										aria-label="Delete task"
										onclick={() => removeTask(t.id)}><Trash2 size={15} /></button
									>
								</div>
							{/each}
						</div>
					{/if}
					{#if doneTasks.length}
						<p class="type-caption glabel donelabel">Done</p>
						<div class="items">
							{#each doneTasks as t (t.id)}
								<div class="itemrow taskrow done">
									<button type="button" class="itemtoggle" onclick={() => toggleTask(t.id)}>
										<span class="check on"><Check size={14} strokeWidth={3} /></span>
										<span class="itext type-body">{t.text}</span>
									</button>
									<button
										type="button"
										class="iconbtn danger"
										aria-label="Delete task"
										onclick={() => removeTask(t.id)}><Trash2 size={15} /></button
									>
								</div>
							{/each}
						</div>
					{/if}
				</section>
			{/if}
		{/if}

		{#if tab === 'meals'}
			{#each mealDays as day (day.key)}
				<section class="card">
					<h2 class="type-label sec-h">{day.label}</h2>
					<div class="items">
						{#each MEAL_TYPES as type (type)}
							{@const m = mealAt(day.key, type)}
							<button type="button" class="itemrow" onclick={() => openMealEditor(day.key, type)}>
								<span class="mtype type-caption">{MEAL_LABEL[type]}</span>
								{#if m}
									<span class="itext type-body">{m.emoji} {m.name}</span>
								{:else}
									<span class="itext type-body sub">Add a meal…</span>
								{/if}
							</button>
						{/each}
					</div>
					{#if editingMeal && editingMeal.date === day.key}
						<div class="profform">
							<div class="sec-head">
								<h3 class="type-label sec-h">{MEAL_LABEL[editingMeal.type]}</h3>
								<button type="button" class="iconbtn" aria-label="Cancel" onclick={closeMealEditor}
									><X size={16} /></button
								>
							</div>
							<input
								class="in"
								type="text"
								placeholder="e.g. Pasta night"
								bind:value={mealDraft}
								maxlength="120"
								onkeydown={(e) => e.key === 'Enter' && saveMeal()}
							/>
							<div class="row">
								<button
									type="button"
									class="btn primary grow"
									disabled={savingMeal}
									onclick={saveMeal}
								>
									{savingMeal ? 'Saving…' : 'Save'}
								</button>
								{#if mealAt(editingMeal.date, editingMeal.type)}
									<button
										type="button"
										class="iconbtn danger"
										aria-label="Clear meal"
										onclick={clearMeal}><Trash2 size={16} /></button
									>
								{/if}
							</div>
						</div>
					{/if}
				</section>
			{/each}
		{/if}

		{#if tab === 'recipes'}
			<section class="card">
				<div class="sec-head">
					<h2 class="type-label sec-h">Recipes</h2>
					{#if !addingRecipe}
						<button type="button" class="addbtn small" onclick={startNewRecipe}
							><Plus size={16} /></button
						>
					{/if}
				</div>
				{#if data.recipes.length === 0 && !addingRecipe}
					<p class="type-body sub empty">No recipes yet.</p>
				{/if}
				<div class="items">
					{#each data.recipes as r (r.id)}
						<div class="recipeblock">
							<button
								type="button"
								class="itemrow"
								onclick={() => (expandedRecipeId = expandedRecipeId === r.id ? null : r.id)}
							>
								<span class="itext type-body">{r.emoji} {r.name}</span>
							</button>
							{#if expandedRecipeId === r.id}
								<div class="recipedetail">
									<p class="type-label lbl">Ingredients</p>
									<ul class="ingredlist type-body">
										{#each r.ingredients as ing (ing)}<li>{ing}</li>{/each}
									</ul>
									<p class="type-label lbl">Steps</p>
									<ol class="ingredlist type-body">
										{#each r.steps as s (s)}<li>{s}</li>{/each}
									</ol>
									<button type="button" class="btn danger" onclick={() => removeRecipeItem(r.id)}>
										<Trash2 size={16} /> Remove recipe
									</button>
								</div>
							{/if}
						</div>
					{/each}
				</div>

				{#if addingRecipe}
					<div class="profform">
						<div class="sec-head">
							<h3 class="type-label sec-h">New recipe</h3>
							<button type="button" class="iconbtn" aria-label="Cancel" onclick={cancelRecipeForm}
								><X size={16} /></button
							>
						</div>
						<label class="field">
							<span class="type-label lbl">Name</span>
							<input class="in" type="text" bind:value={recipeName} maxlength="120" />
						</label>
						<label class="field">
							<span class="type-label lbl">Ingredients (one per line)</span>
							<textarea class="in taxt" rows="4" bind:value={recipeIngredients}></textarea>
						</label>
						<label class="field">
							<span class="type-label lbl">Steps (one per line)</span>
							<textarea class="in taxt" rows="4" bind:value={recipeSteps}></textarea>
						</label>
						{#if recipeFormError}<p class="type-caption err">{recipeFormError}</p>{/if}
						<button type="button" class="btn primary" disabled={savingRecipe} onclick={saveRecipe}>
							{savingRecipe ? 'Saving…' : 'Save'}
						</button>
					</div>
				{/if}
			</section>
		{/if}

		{#if tab === 'routines'}
			{#if routinesByProfile.length === 0}
				<p class="type-body sub empty">No one has routines turned on right now.</p>
			{:else}
				{#each routinesByProfile as { profile: p, routines: rs } (p.id)}
					<section class="card">
						<div class="sec-head">
							<h2 class="type-label sec-h">{p.avatarEmoji} {p.name}</h2>
							<span class="type-caption sub">⭐ {starsFor(p.id)}</span>
						</div>
						{#each rs as routine (routine.id)}
							{@const doneStepIds = doneStepsFor(routine)}
							{@const doneCount = doneStepIds.length}
							{@const total = routine.steps.length}
							<div class="routineblock">
								<div class="row">
									<span class="type-label grow"
										>{routine.name}
										<span class="type-caption sub">{doneCount}/{total}</span></span
									>
									{#if routine.streakCurrent > 0}
										<span class="type-caption streak">🔥 {routine.streakCurrent}</span>
									{/if}
								</div>
								<div class="items">
									{#each routine.steps as step (step.id)}
										{@const done = doneStepIds.includes(step.id)}
										<button
											type="button"
											class="itemrow"
											class:done
											onclick={() => toggleRoutineStep(routine, step.id)}
										>
											<span class="check" class:on={done}
												>{#if done}<Check size={14} strokeWidth={3} />{/if}</span
											>
											<span class="itext type-body">{step.label}</span>
										</button>
									{/each}
								</div>
							</div>
						{/each}
					</section>
				{/each}
			{/if}
		{/if}

		{#if tab === 'rewards'}
			{#if rewardKids.length}
				<section class="card">
					<h2 class="type-label sec-h">Stars</h2>
					<div class="starsrow">
						{#each rewardKids as kid (kid.id)}
							<div class="starkid">
								<span class="type-body">{kid.avatarEmoji} {kid.name}</span>
								<span class="type-label starcount">⭐ {starsFor(kid.id)}</span>
							</div>
						{/each}
					</div>
				</section>
			{/if}

			<section class="card">
				<div class="sec-head">
					<h2 class="type-label sec-h">Reward Ladder</h2>
					<button
						type="button"
						class="iconbtn"
						aria-label="Manage rewards"
						onclick={() => (rewardsManaging = !rewardsManaging)}
						>{#if rewardsManaging}<X size={16} />{:else}<Pencil size={15} />{/if}</button
					>
				</div>
				{#if !rewardsManaging}
					{#if activeRewards.length === 0}
						<p class="type-body sub empty">No rewards yet — tap the pencil to add one.</p>
					{:else}
						<div class="items">
							{#each activeRewards as reward (reward.id)}
								<div class="rewardrow">
									<span class="ricon">{reward.icon}</span>
									<div class="rmain">
										<p class="type-body">{reward.name}</p>
										<p class="type-caption sub">{reward.starCost} ⭐</p>
									</div>
									<div class="chips">
										{#each rewardKids as kid (kid.id)}
											{@const canClaim = starsFor(kid.id) >= reward.starCost}
											<button
												type="button"
												class="chip"
												class:on={canClaim}
												disabled={!canClaim}
												onclick={() => claimReward(reward.id, kid.id, kid.name, reward.name)}
												>{kid.avatarEmoji}</button
											>
										{/each}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				{:else}
					<div class="items">
						{#each data.rewards as reward (reward.id)}
							<div class="rewardrow" class:inactive={!reward.active}>
								<span class="ricon">{reward.icon}</span>
								<div class="rmain">
									<p class="type-body">{reward.name}</p>
									<p class="type-caption sub">{reward.starCost} ⭐</p>
								</div>
								<button
									type="button"
									class="switch"
									class:on={reward.active}
									role="switch"
									aria-checked={reward.active}
									aria-label="Active"
									onclick={() => toggleRewardActive(reward)}><span class="knob"></span></button
								>
								<button
									type="button"
									class="iconbtn danger"
									aria-label="Remove {reward.name}"
									onclick={() => removeReward(reward.id)}><Trash2 size={15} /></button
								>
							</div>
						{/each}
					</div>
					<div class="rewardaddform">
						<input
							class="in"
							type="text"
							placeholder="Reward name"
							bind:value={newRewardName}
							maxlength="120"
						/>
						<div class="chips">
							{#each ['🎁', '🍦', '🎮', '🎬', '🍕', '🏖️', '📱', '🧸'] as a (a)}
								<button
									type="button"
									class="emojidot"
									class:on={newRewardIcon === a}
									onclick={() => (newRewardIcon = a)}>{a}</button
								>
							{/each}
						</div>
						<div class="row">
							<input
								class="in grow"
								type="number"
								placeholder="Star cost"
								min="1"
								max="1000"
								bind:value={newRewardCost}
							/>
							<button
								type="button"
								class="btn primary"
								disabled={!newRewardName.trim() || newRewardCost === '' || savingReward}
								onclick={addReward}
							>
								<Plus size={16} />{savingReward ? 'Adding…' : 'Add'}
							</button>
						</div>
					</div>
				{/if}
			</section>

			{#if claimedToast}
				<p class="type-caption saved-msg"><Star size={14} strokeWidth={3} /> {claimedToast}</p>
			{/if}
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
		overflow-x: auto;
		scrollbar-width: none;
	}
	.tabs::-webkit-scrollbar {
		display: none;
	}
	.tab {
		flex: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 9px 12px;
		border-radius: var(--radius-pill);
		color: var(--color-text-secondary);
		font-weight: var(--weight-semibold);
		font-size: var(--text-sm);
		white-space: nowrap;
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
	.chip.on {
		background: var(--color-text-primary);
		color: var(--color-surface);
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
	.btn.secondary {
		width: 100%;
		background: var(--color-surface);
		color: var(--color-text-primary);
		box-shadow: var(--shadow-card);
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
		width: 100%;
		padding: var(--space-3);
		background: var(--color-surface);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow-card);
		text-align: left;
		font: inherit;
		color: inherit;
	}
	.erow.editable {
		cursor: pointer;
	}
	.erow.editable:active {
		background: var(--color-surface-elevated);
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
	.taskrow {
		padding: 4px 4px 4px 10px;
	}
	.itemtoggle {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		flex: 1;
		min-width: 0;
		padding: 6px 0;
		text-align: left;
	}
	.mtype {
		flex: none;
		width: 76px;
		color: var(--color-text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.donelabel {
		margin-top: var(--space-2);
	}
	.recipeblock {
		display: flex;
		flex-direction: column;
	}
	.recipedetail {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-3) var(--space-2);
	}
	.ingredlist {
		margin: 0;
		padding-left: 1.3em;
		color: var(--color-text-primary);
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.taxt {
		font-family: inherit;
		resize: vertical;
	}
	.btn.danger {
		background: color-mix(in srgb, var(--color-accent-warning) 15%, var(--color-surface));
		color: var(--color-accent-warning);
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
	.eventtitle-ro {
		font-weight: var(--weight-semibold);
		color: var(--color-text-primary);
		font-size: var(--text-lg);
	}
	.saved-msg {
		display: flex;
		align-items: center;
		gap: 4px;
		color: var(--color-accent-success);
	}
	.btn.primary:disabled {
		opacity: 0.5;
	}
	.addbtn.small {
		width: 40px;
		height: 40px;
		border-radius: var(--radius-pill);
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
	.routineblock {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding-top: var(--space-3);
		border-top: 1px solid var(--color-border-hairline);
	}
	.streak {
		color: var(--color-text-tertiary);
		flex: none;
	}
	.starsrow {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.starkid {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 4px;
		border-bottom: 1px solid var(--color-border-hairline);
	}
	.starkid:last-child {
		border-bottom: none;
	}
	.starcount {
		color: var(--color-text-primary);
	}
	.rewardrow {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3);
		border-radius: var(--radius-md);
		background: var(--color-surface-elevated);
	}
	.rewardrow.inactive {
		opacity: 0.5;
	}
	.ricon {
		font-size: 1.6rem;
		flex: none;
	}
	.rmain {
		flex: 1;
		min-width: 0;
	}
	.rewardaddform {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding-top: var(--space-3);
		border-top: 1px solid var(--color-border-hairline);
	}
</style>
