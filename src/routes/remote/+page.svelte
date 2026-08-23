<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { mirror } from '$lib/stores/mirror.svelte';
	import { profileColorVar, profileTint, PROFILE_COLORS } from '$lib/design/colors';
	import { AVATAR_CHOICES } from '$lib/setup/types';
	import { autoEmojiFor } from '$lib/meals';
	import { formatRange, ageFromDOB } from '$lib/time';
	import Avatar from '$lib/components/Avatar.svelte';
	import GoogleConnect from '$lib/components/GoogleConnect.svelte';
	import StoragePanel from '$lib/components/StoragePanel.svelte';
	import { routinesOn } from '$lib/types';
	import type { FeatureFlags } from '$lib/config';
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
		X,
		UtensilsCrossed,
		BookOpen,
		Sparkles,
		Gift,
		Star,
		Wifi,
		RefreshCw,
		Link as LinkIcon
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
	type Tab =
		| 'calendar'
		| 'lists'
		| 'tasks'
		| 'meals'
		| 'recipes'
		| 'routines'
		| 'rewards'
		| 'settings';
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
		rewards: '/rewards',
		settings: '/settings'
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
	let editingEventId = $state<number | null>(null); // raw local id (no LOCAL_ID_BASE offset), null = adding new

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

	// Synced events (from an external calendar) can't have their title/time
	// edited here — the next sync would just overwrite that — but WHO it's
	// for is a local call, so that's the one field reassignable on them.
	let reassigningEvent = $state<{ id: number; title: string; profileId: number | null } | null>(
		null
	);
	let savingReassign = $state(false);
	function reassignEvent(profileId: number | null) {
		if (!reassigningEvent) return;
		savingReassign = true;
		fetch('/api/mirror/event-profile', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ token: data.token, id: reassigningEvent.id, profileId })
		})
			.then(async (r) => {
				if (r.ok) {
					reassigningEvent = null;
					await invalidateAll();
				}
			})
			.finally(() => (savingReassign = false));
	}

	function editEvent(e: PageData['events'][number]) {
		if (e.id < LOCAL_ID_BASE) {
			reassigningEvent = { id: e.id, title: e.title, profileId: e.profileIds[0] ?? null };
			return;
		}
		editingEventId = e.id - LOCAL_ID_BASE;
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
		editingEventId = null;
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
					id: editingEventId ?? undefined,
					title: title.trim(),
					startTs,
					endTs,
					allDay,
					location: location.trim() || undefined,
					profileIds
				})
			});
			if (r.ok) {
				const wasEdit = editingEventId !== null;
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

	async function removeEvent() {
		if (editingEventId === null) return;
		savingEvent = true;
		try {
			await fetch('/api/mirror/event-remove', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ token: data.token, id: editingEventId })
			});
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
				body: JSON.stringify({ token: data.token, name, kind: newListKind, icon: LIST_KIND_ICON[newListKind] })
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
		const name = `${r.name}${r.admin1 ? ', ' + r.admin1 : ''}`;
		locQuery = name;
		await fetch('/api/mirror/settings', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				token: data.token,
				latitude: r.latitude,
				longitude: r.longitude,
				timezone: r.timezone,
				locationName: name
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
	let profDob = $state('');
	let profColor = $state<ProfileColor>('pink');
	let profAvatar = $state<string>(AVATAR_CHOICES[0]);
	let savingProfile = $state(false);
	let profileFormError = $state('');
	const profAgePreview = $derived(profDob ? ageFromDOB(profDob) : null);

	function startNewProfile() {
		editingProfileId = null;
		addingProfile = true;
		profName = '';
		profDob = '';
		profColor = 'pink';
		profAvatar = AVATAR_CHOICES[0];
		profileFormError = '';
	}
	function startEditProfile(p: PageData['profiles'][number]) {
		editingProfileId = p.id;
		addingProfile = true;
		profName = p.name;
		// Only age is persisted, not a real birth date — approximate one (Jan 1
		// of the birth year) so the picker has a sane starting point; editing
		// this recalculates age same as a fresh add.
		profDob = `${new Date().getFullYear() - p.age}-01-01`;
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
		if (!name || !profDob) {
			profileFormError = 'Add a name and date of birth.';
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
					age: ageFromDOB(profDob),
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

	// --- Meals ---
	type MealType = 'breakfast' | 'lunch' | 'dinner';
	const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner'];
	const MEAL_LABEL: Record<MealType, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };

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
		const ingredients = recipeIngredients.split('\n').map((s) => s.trim()).filter(Boolean);
		const steps = recipeSteps.split('\n').map((s) => s.trim()).filter(Boolean);
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
	async function claimReward(rewardId: number, profileId: number, kidName: string, rewardName: string) {
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

	// --- Settings: advanced (full config, posted wholesale — same as desktop) ---
	let cfg = $state(structuredClone(data.config));
	let cfgSaveTimer: ReturnType<typeof setTimeout>;
	let cfgSaved = $state(false);
	function persistCfg() {
		clearTimeout(cfgSaveTimer);
		cfgSaveTimer = setTimeout(async () => {
			try {
				await fetch('/api/config', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(cfg)
				});
				cfgSaved = true;
				setTimeout(() => (cfgSaved = false), 1400);
			} catch {
				/* offline; will re-save on next change */
			}
		}, 400);
	}

	const featureLabels: Record<keyof FeatureFlags, string> = {
		calendar: 'Calendar',
		lists: 'Lists',
		tasks: 'Tasks',
		rewards: 'Rewards',
		meals: 'Meal planning',
		recipes: 'Recipes',
		photos: 'Photos',
		sleep: 'Sleep mode',
		routines: 'Kid routines',
		feelings: "Today's Feelings",
		sitesOfInterest: 'Sites of Interest'
	};
	const featureKeys = Object.keys(featureLabels) as (keyof FeatureFlags)[];
	function toggleFeature(k: keyof FeatureFlags) {
		cfg.app.features[k] = !cfg.app.features[k];
		persistCfg();
	}

	async function setDisplayMode(mode: 'tv' | 'touch') {
		cfg.displayMode = mode;
		await fetch('/api/display-mode', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ displayMode: mode })
		}).catch(() => {});
	}

	// --- Settings: Wi-Fi (native inputs — no on-screen keyboard needed on a phone) ---
	interface WifiNetwork {
		ssid: string;
		signal: number;
		secured: boolean;
		active: boolean;
	}
	let wifiStatus = $state<{ online: boolean; ssid: string | null } | null>(null);
	let wifiOpen = $state(false);
	let wifiNetworks = $state<WifiNetwork[]>([]);
	let wifiScanning = $state(false);
	let wifiSelected = $state<WifiNetwork | null>(null);
	let wifiPassword = $state('');
	let wifiJoining = $state(false);
	let wifiError = $state('');
	async function loadWifiStatus() {
		try {
			const r = await fetch('/api/net/status');
			if (r.ok) wifiStatus = await r.json();
		} catch {
			/* keep last known state */
		}
	}
	async function scanWifi() {
		wifiScanning = true;
		wifiError = '';
		try {
			const r = await fetch('/api/net/wifi/scan');
			if (r.ok) wifiNetworks = (await r.json()).networks ?? [];
		} catch {
			wifiError = "Couldn't scan for networks.";
		} finally {
			wifiScanning = false;
		}
	}
	async function joinWifi() {
		if (!wifiSelected) return;
		wifiJoining = true;
		wifiError = '';
		try {
			const r = await fetch('/api/net/wifi/join', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ ssid: wifiSelected.ssid, password: wifiPassword })
			});
			const res = await r.json();
			if (res.ok) {
				wifiOpen = false;
				wifiSelected = null;
				wifiPassword = '';
				await loadWifiStatus();
			} else {
				wifiError = res.message ?? 'Could not join that network.';
			}
		} catch {
			wifiError = 'Could not join that network.';
		} finally {
			wifiJoining = false;
		}
	}

	// --- Settings: calendars (subscribe by iCal/webcal link) ---
	interface CalendarLink {
		id: number;
		name: string;
		externalId: string;
		profileId?: number;
		isBirthdays: boolean;
	}
	let calendars = $state<CalendarLink[]>([]);
	let calLoaded = $state(false);
	let calUrl = $state('');
	let calName = $state('');
	let calProfileId = $state<number | ''>('');
	let calIsBirthdays = $state(false);
	let savingCal = $state(false);
	let calError = $state('');
	async function loadCalendars() {
		try {
			const r = await fetch('/api/calendars');
			if (r.ok) calendars = await r.json();
			calLoaded = true;
		} catch {
			/* keep last known list */
		}
	}
	async function addCalendar() {
		const url = calUrl.trim();
		if (!url) return;
		savingCal = true;
		calError = '';
		try {
			const r = await fetch('/api/calendars', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					url,
					name: calName.trim(),
					profileId: calProfileId === '' ? undefined : Number(calProfileId),
					isBirthdays: calIsBirthdays
				})
			});
			if (r.ok) {
				calUrl = '';
				calName = '';
				calProfileId = '';
				calIsBirthdays = false;
				await loadCalendars();
			} else {
				calError = (await r.json().catch(() => ({})))?.message ?? 'Could not add that calendar.';
			}
		} finally {
			savingCal = false;
		}
	}
	async function toggleCalBirthdays(c: CalendarLink) {
		await fetch('/api/calendars/birthdays', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ id: c.id, isBirthdays: !c.isBirthdays })
		});
		await loadCalendars();
	}

	// --- Settings: software updates ---
	let updateVersion = $state<{ commit: string; dirty: boolean } | null>(null);
	let checkingUpdate = $state(false);
	let updateMsg = $state('');
	async function loadUpdateVersion() {
		try {
			const r = await fetch('/api/update');
			if (r.ok) updateVersion = await r.json();
		} catch {
			/* keep last known */
		}
	}
	async function checkUpdates() {
		checkingUpdate = true;
		updateMsg = '';
		try {
			const r = await fetch('/api/update', { method: 'POST' });
			updateMsg = r.ok ? 'Checking for updates…' : 'Could not start update check.';
		} finally {
			checkingUpdate = false;
		}
	}

	// --- Settings: parental lock ---
	let pinSet = $state(false);
	let showPinForm = $state(false);
	let newPin = $state('');
	let currentPin = $state('');
	let pinMsg = $state('');
	async function loadPinStatus() {
		try {
			const r = await fetch('/api/pin');
			if (r.ok) pinSet = (await r.json())?.pinSet ?? false;
		} catch {
			/* keep last known */
		}
	}
	async function savePin() {
		pinMsg = '';
		const r = await fetch('/api/pin', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ pin: newPin, current: currentPin || undefined })
		});
		if (r.ok) {
			pinSet = true;
			showPinForm = false;
			newPin = '';
			currentPin = '';
			pinMsg = 'PIN saved.';
		} else {
			pinMsg = (await r.json().catch(() => ({})))?.message ?? 'Could not save PIN.';
		}
	}
	function toggleParentalLock() {
		if (!cfg.app.kiosk.parentalLock && !pinSet) {
			showPinForm = true;
			pinMsg = 'Set a PIN first to enable the lock.';
			return;
		}
		cfg.app.kiosk.parentalLock = !cfg.app.kiosk.parentalLock;
		persistCfg();
	}

	let settingsExtrasLoaded = $state(false);
	function loadSettingsExtras() {
		if (settingsExtrasLoaded) return;
		settingsExtrasLoaded = true;
		loadWifiStatus();
		loadCalendars();
		loadUpdateVersion();
		loadPinStatus();
	}
	$effect(() => {
		if (tab === 'settings') loadSettingsExtras();
	});
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
			<button type="button" class="tab" class:on={tab === 'meals'} onclick={() => (tab = 'meals')}>
				<UtensilsCrossed size={16} /> Meals
			</button>
			<button type="button" class="tab" class:on={tab === 'recipes'} onclick={() => (tab = 'recipes')}>
				<BookOpen size={16} /> Recipes
			</button>
			{#if data.routines.length}
				<button type="button" class="tab" class:on={tab === 'routines'} onclick={() => (tab = 'routines')}>
					<Sparkles size={16} /> Routines
				</button>
			{/if}
			<button type="button" class="tab" class:on={tab === 'rewards'} onclick={() => (tab = 'rewards')}>
				<Gift size={16} /> Rewards
			</button>
			<button type="button" class="tab" class:on={tab === 'settings'} onclick={() => (tab = 'settings')}>
				<Settings size={16} /> Settings
			</button>
		</nav>

		{#if tab === 'calendar'}
			<section class="card">
				<div class="sec-head">
					<h3 class="type-label sec-h">{editingEventId !== null ? 'Edit event' : 'New event'}</h3>
					{#if editingEventId !== null}
						<button type="button" class="iconbtn" aria-label="Cancel" onclick={cancelEventForm}
							><X size={16} /></button
						>
					{/if}
				</div>
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
				<div class="row">
					<button
						type="button"
						class="btn primary grow"
						disabled={savingEvent}
						onclick={addEvent}
					>
						{#if eventAdded}<Check size={18} /> {editingEventId !== null
								? 'Saved'
								: 'Added'}{:else}<Plus size={18} />{savingEvent
								? 'Saving…'
								: editingEventId !== null
									? 'Save changes'
									: 'Add event'}{/if}
					</button>
					{#if editingEventId !== null}
						<button
							type="button"
							class="iconbtn danger"
							aria-label="Delete event"
							disabled={savingEvent}
							onclick={removeEvent}><Trash2 size={16} /></button
						>
					{/if}
				</div>
			</section>

			{#if reassigningEvent}
				<section class="card">
					<div class="sec-head">
						<h3 class="type-label sec-h">Move "{reassigningEvent.title}" to…</h3>
						<button
							type="button"
							class="iconbtn"
							aria-label="Cancel"
							onclick={() => (reassigningEvent = null)}><X size={16} /></button
						>
					</div>
					<p class="type-caption sub">
						This event is synced from a calendar, so its title and time can't be changed here —
						but who it's for can.
					</p>
					<div class="chips">
						<button
							type="button"
							class="chip"
							class:on={reassigningEvent.profileId === null}
							disabled={savingReassign}
							onclick={() => reassignEvent(null)}>Unassigned</button
						>
						{#each data.profiles as p (p.id)}
							<button
								type="button"
								class="chip"
								class:on={reassigningEvent.profileId === p.id}
								style:background={reassigningEvent.profileId === p.id
									? profileTint(p.color, 45)
									: ''}
								style:box-shadow={reassigningEvent.profileId === p.id
									? `inset 0 0 0 2px ${profileColorVar(p.color)}`
									: ''}
								disabled={savingReassign}
								onclick={() => reassignEvent(p.id)}>{p.avatarEmoji} {p.name}</button
							>
						{/each}
					</div>
				</section>
			{/if}

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
									onclick={() => (newListKind = kind as typeof newListKind)}
									>{icon} {kind}</button
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
								<button type="button" class="btn primary grow" disabled={savingMeal} onclick={saveMeal}>
									{savingMeal ? 'Saving…' : 'Save'}
								</button>
								{#if mealAt(editingMeal.date, editingMeal.type)}
									<button type="button" class="iconbtn danger" aria-label="Clear meal" onclick={clearMeal}
										><Trash2 size={16} /></button
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
					<button type="button" class="iconbtn" aria-label="Manage rewards" onclick={() => (rewardsManaging = !rewardsManaging)}
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
				<div class="sec-head">
					<h2 class="type-label sec-h">Wi-Fi</h2>
					<p class="type-caption sub">
						{#if wifiStatus === null}Checking…{:else if wifiStatus.online}Connected{wifiStatus.ssid
								? ` to "${wifiStatus.ssid}"`
								: ''}.{:else}Not connected.{/if}
					</p>
				</div>
				{#if !wifiOpen}
					<button
						type="button"
						class="btn secondary"
						onclick={() => {
							wifiOpen = true;
							scanWifi();
						}}
					>
						<Wifi size={16} />{wifiStatus?.online ? 'Change network' : 'Connect to Wi-Fi'}
					</button>
				{:else if wifiSelected}
					<div class="field">
						<span class="type-label lbl"
							>{wifiSelected.secured ? 'Password for' : 'Join'} "{wifiSelected.ssid}"</span
						>
						{#if wifiSelected.secured}
							<input class="in" type="password" bind:value={wifiPassword} placeholder="Wi-Fi password" />
						{/if}
					</div>
					{#if wifiError}<p class="type-caption err">{wifiError}</p>{/if}
					<div class="row">
						<button
							type="button"
							class="btn primary grow"
							disabled={wifiJoining}
							onclick={joinWifi}
						>
							{wifiJoining ? 'Joining…' : 'Join'}
						</button>
						<button
							type="button"
							class="iconbtn"
							aria-label="Cancel"
							onclick={() => {
								wifiSelected = null;
								wifiPassword = '';
							}}><X size={16} /></button
						>
					</div>
				{:else}
					<div class="row">
						<span class="type-caption sub grow">{wifiScanning ? 'Scanning…' : 'Nearby networks'}</span>
						<button type="button" class="iconbtn" aria-label="Rescan" onclick={scanWifi}
							><RefreshCw size={15} /></button
						>
					</div>
					{#if wifiNetworks.length}
						<div class="items">
							{#each wifiNetworks as n (n.ssid)}
								<button
									type="button"
									class="itemrow"
									onclick={() => {
										wifiSelected = n;
										wifiPassword = '';
									}}
								>
									<span class="itext type-body">{n.ssid}{n.active ? ' (current)' : ''}</span>
									{#if n.secured}<span class="tfor type-caption">🔒</span>{/if}
								</button>
							{/each}
						</div>
					{/if}
					{#if wifiError}<p class="type-caption err">{wifiError}</p>{/if}
					<button type="button" class="iconbtn cancel-text" onclick={() => (wifiOpen = false)}
						>Cancel</button
					>
				{/if}
			</section>

			<section class="card">
				<h2 class="type-label sec-h">Screen type</h2>
				<div class="chips">
					<button
						type="button"
						class="chip"
						class:on={(cfg.displayMode ?? 'tv') === 'tv'}
						onclick={() => setDisplayMode('tv')}>TV / Monitor</button
					>
					<button
						type="button"
						class="chip"
						class:on={cfg.displayMode === 'touch'}
						onclick={() => setDisplayMode('touch')}>Touchscreen</button
					>
				</div>
			</section>

			<section class="card">
				<h2 class="type-label sec-h">Display orientation</h2>
				<div class="chips">
					{#each [{ v: 'auto', label: 'Auto' }, { v: 'landscape', label: 'Landscape' }, { v: 'portrait', label: 'Portrait' }] as opt (opt.v)}
						<button
							type="button"
							class="chip"
							class:on={cfg.app.view.orientation === opt.v}
							onclick={() => {
								cfg.app.view.orientation = opt.v as 'auto' | 'landscape' | 'portrait';
								persistCfg();
							}}>{opt.label}</button
						>
					{/each}
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
				<div class="row">
					<span class="type-label grow">Week starts on</span>
					<div class="chips">
						<button
							type="button"
							class="chip"
							class:on={cfg.app.view.weekStartsOn === 1}
							onclick={() => {
								cfg.app.view.weekStartsOn = 1;
								persistCfg();
							}}>Monday</button
						>
						<button
							type="button"
							class="chip"
							class:on={cfg.app.view.weekStartsOn === 0}
							onclick={() => {
								cfg.app.view.weekStartsOn = 0;
								persistCfg();
							}}>Sunday</button
						>
					</div>
				</div>
				<div class="row">
					<span class="type-label grow">Celebrations</span>
					<button
						type="button"
						class="switch"
						class:on={cfg.app.celebrations}
						role="switch"
						aria-checked={cfg.app.celebrations}
						aria-label="Celebrations"
						onclick={() => {
							cfg.app.celebrations = !cfg.app.celebrations;
							persistCfg();
						}}><span class="knob"></span></button
					>
				</div>
				<div class="row">
					<span class="type-label grow"
						>Read-only display <span class="type-caption sub">edits from a phone only</span></span
					>
					<button
						type="button"
						class="switch"
						class:on={cfg.app.kiosk.readOnly}
						role="switch"
						aria-checked={cfg.app.kiosk.readOnly}
						aria-label="Read-only display"
						onclick={() => {
							cfg.app.kiosk.readOnly = !cfg.app.kiosk.readOnly;
							persistCfg();
						}}><span class="knob"></span></button
					>
				</div>
				{#if cfgSaved}<p class="type-caption saved-msg"><Check size={14} strokeWidth={3} /> Saved</p>{/if}
			</section>

			{#if cfg.profiles.length}
				<section class="card">
					<h2 class="type-label sec-h">Routines</h2>
					<p class="type-caption sub">Age-appropriate morning &amp; evening routines.</p>
					{#each cfg.profiles as p (p.id)}
						{@const on = routinesOn(p)}
						<div class="row">
							<span class="type-body grow">{p.name}</span>
							<button
								type="button"
								class="switch"
								class:on
								role="switch"
								aria-checked={on}
								aria-label="Routines for {p.name}"
								onclick={() => {
									p.routinesEnabled = !on;
									persistCfg();
								}}><span class="knob"></span></button
							>
						</div>
					{/each}
				</section>
			{/if}

			<section class="card">
				<h2 class="type-label sec-h">Features</h2>
				<p class="type-caption sub">Turn a feature off to hide its tab on the display.</p>
				{#each featureKeys as k (k)}
					<div class="row">
						<span class="type-label grow">{featureLabels[k]}</span>
						<button
							type="button"
							class="switch"
							class:on={cfg.app.features[k]}
							role="switch"
							aria-checked={cfg.app.features[k]}
							aria-label={featureLabels[k]}
							onclick={() => toggleFeature(k)}><span class="knob"></span></button
						>
					</div>
				{/each}
			</section>

			<section class="card">
				<h2 class="type-label sec-h">Calendars</h2>
				<p class="type-caption sub">Subscribe to any calendar by iCal/webcal link.</p>
				<label class="field">
					<span class="type-label lbl">Link</span>
					<input class="in" type="text" placeholder="https://…/basic.ics" bind:value={calUrl} />
				</label>
				<label class="field">
					<span class="type-label lbl">Name (optional)</span>
					<input class="in" type="text" bind:value={calName} maxlength="60" />
				</label>
				{#if data.profiles.length}
					<label class="field">
						<span class="type-label lbl">For</span>
						<select class="in" bind:value={calProfileId}>
							<option value="">Household</option>
							{#each data.profiles as p (p.id)}
								<option value={p.id}>{p.name}</option>
								{/each}
							</select>
						</label>
					{/if}
				<label class="birthdaycheck type-caption">
					<input type="checkbox" bind:checked={calIsBirthdays} />
					🎂 This is a birthdays calendar
				</label>
				{#if calError}<p class="type-caption err">{calError}</p>{/if}
				<button
					type="button"
					class="btn primary"
					disabled={!calUrl.trim() || savingCal}
					onclick={addCalendar}
				>
					<LinkIcon size={16} />{savingCal ? 'Adding…' : 'Subscribe'}
				</button>
				{#if calLoaded && calendars.length}
					<div class="items">
						{#each calendars as c (c.id)}
							<div class="itemrow">
								<span class="itext type-body">{c.name}</span>
								<button
									type="button"
									class="cake"
									class:on={c.isBirthdays}
									aria-label={c.isBirthdays
										? 'Birthdays calendar (tap to unmark)'
										: 'Mark as birthdays calendar'}
									onclick={() => toggleCalBirthdays(c)}>🎂</button
								>
							</div>
						{/each}
					</div>
				{/if}
				<div class="divider"></div>
				<GoogleConnect />
			</section>

			<section class="card">
				<h2 class="type-label sec-h">Software updates</h2>
				<div class="row">
					<span class="type-label grow"
						>Version <span class="type-caption sub"
							>{updateVersion
								? updateVersion.commit + (updateVersion.dirty ? ' (modified)' : '')
								: '…'}</span
						></span
					>
					<button type="button" class="iconbtn" disabled={checkingUpdate} onclick={checkUpdates}
						><RefreshCw size={15} /></button
					>
				</div>
				<div class="row">
					<span class="type-label grow"
						>Automatic updates <span class="type-caption sub"
							>every {cfg.app.updates.intervalHours}h</span
						></span
					>
					<button
						type="button"
						class="switch"
						class:on={!cfg.app.updates.paused}
						role="switch"
						aria-checked={!cfg.app.updates.paused}
						aria-label="Automatic updates"
						onclick={() => {
							cfg.app.updates.paused = !cfg.app.updates.paused;
							persistCfg();
						}}><span class="knob"></span></button
					>
				</div>
				{#if updateMsg}<p class="type-caption sub">{updateMsg}</p>{/if}
			</section>

			<section class="card">
				<h2 class="type-label sec-h">Data storage</h2>
				<p class="type-caption sub">Keep personal data local on this device, or on a NAS folder.</p>
				<StoragePanel />
			</section>

			<section class="card">
				<h2 class="type-label sec-h">Parental lock</h2>
				<p class="type-caption sub">Require a PIN to open Settings on the display.</p>
				<div class="row">
					<span class="type-label grow"
						>Lock Settings <span class="type-caption sub"
							>{pinSet ? 'PIN is set' : 'no PIN yet'}</span
						></span
					>
					<button
						type="button"
						class="switch"
						class:on={cfg.app.kiosk.parentalLock}
						role="switch"
						aria-checked={cfg.app.kiosk.parentalLock}
						aria-label="Lock Settings"
						onclick={toggleParentalLock}><span class="knob"></span></button
					>
				</div>
				<div class="row">
					<span class="type-label grow">{pinSet ? 'Change PIN' : 'Set a PIN'}</span>
					<button type="button" class="btn primary small" onclick={() => (showPinForm = !showPinForm)}
						>{showPinForm ? 'Cancel' : pinSet ? 'Change' : 'Set PIN'}</button
					>
				</div>
				{#if showPinForm}
					<div class="row">
						{#if pinSet}
							<input
								class="in grow"
								type="password"
								inputmode="numeric"
								placeholder="Current PIN"
								bind:value={currentPin}
							/>
						{/if}
						<input
							class="in grow"
							type="password"
							inputmode="numeric"
							placeholder="New PIN (4–8 digits)"
							bind:value={newPin}
						/>
					</div>
					<button type="button" class="btn primary" onclick={savePin}>Save PIN</button>
				{/if}
				{#if pinMsg}<p class="type-caption sub">{pinMsg}</p>{/if}
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
				{:else if data.locationName}
					<p class="type-caption sub">Current: {data.locationName} ({data.timezone})</p>
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
								<span class="type-label lbl">Date of birth</span>
								<input class="in agein" type="date" bind:value={profDob} />
								{#if profAgePreview !== null}
									<span class="type-caption agepreview">{profAgePreview} yrs old</span>
								{/if}
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
	.cake {
		flex: none;
		width: 30px;
		height: 30px;
		display: grid;
		place-items: center;
		border-radius: var(--radius-pill);
		font-size: 1rem;
		opacity: 0.35;
	}
	.cake.on {
		opacity: 1;
		background: color-mix(in srgb, var(--color-accent-warning) 20%, var(--color-surface));
	}
	.birthdaycheck {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--color-text-secondary);
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
	.saved-msg {
		display: flex;
		align-items: center;
		gap: 4px;
		color: var(--color-accent-success);
	}
	.divider {
		height: 1px;
		background: var(--color-border-subtle);
		margin: var(--space-1) 0;
	}
	.cancel-text {
		width: auto;
		height: auto;
		border-radius: 0;
		background: none;
		align-self: center;
		color: var(--color-text-tertiary);
		font-weight: var(--weight-medium);
		font-size: var(--text-sm);
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
		width: 148px;
	}
	.agepreview {
		color: var(--color-text-tertiary);
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
