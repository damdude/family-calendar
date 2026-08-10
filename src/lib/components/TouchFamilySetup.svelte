<script lang="ts">
	/**
	 * On-screen family + profile setup for touch mode — the same job the phone
	 * wizard (`/setup/pair`) does, but entered directly on the touchscreen with
	 * the virtual keyboard, so touch mode never has to hand off to a phone.
	 *
	 * Submits to the same `/setup/complete` endpoint the phone wizard uses (via
	 * the pairing token this device's own setup session already holds), so the
	 * two paths converge on identical, already-validated server logic.
	 */
	import { onMount, tick } from 'svelte';
	import {
		AVATAR_CHOICES,
		ageFromBirthdate,
		defaultBirthdate,
		randomId,
		todayDateStr,
		type ProfileDraft,
		type SetupDraft
	} from '$lib/setup/types';
	import type { ProfileColor } from '$lib/types';
	import { PROFILE_COLORS, profileColorVar, profileTint } from '$lib/design/colors';
	import OnScreenKeyboard from './OnScreenKeyboard.svelte';
	import { Plus, X, Check, ChevronRight, ChevronLeft } from 'lucide-svelte';

	let { token, oncomplete }: { token: string; oncomplete: (familyName: string) => void } = $props();

	let step = $state(1);
	let saving = $state(false);
	let errorMsg = $state('');

	let draft = $state<SetupDraft>({
		family: { name: '', timezone: 'UTC', weekStartsOn: 1 },
		profiles: []
	});
	let timezones = $state<string[]>(['UTC']);

	onMount(() => {
		try {
			draft.family.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
			const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] })
				.supportedValuesOf;
			if (fn) timezones = fn('timeZone');
		} catch {
			/* keep UTC */
		}
	});

	let nameKeyboardOpen = $state(false);

	// --- People ---
	let newName = $state('');
	let newBirthdate = $state(defaultBirthdate());
	let newColor = $state<ProfileColor>('pink');
	let newAvatar = $state<string>(AVATAR_CHOICES[0]);
	let personKeyboardOpen = $state(false);
	const todayStr = todayDateStr();

	const usedColors = $derived(new Set(draft.profiles.map((p) => p.color)));
	function suggestColor(): ProfileColor {
		return PROFILE_COLORS.find((c) => !usedColors.has(c)) ?? 'pink';
	}

	// Confirms the add right where the person is looking. The person list this
	// appends to sits above the form (name, DOB, color, avatar, button), so once
	// the on-screen keyboard has pushed the button down the screen, a successful
	// add is otherwise completely silent — it looks like nothing happened.
	// Scrolling the new person into view fixes that directly.
	let justAdded = $state('');
	let justAddedTimer: ReturnType<typeof setTimeout>;
	async function addProfile() {
		const name = newName.trim();
		if (!name) return;
		const p: ProfileDraft = {
			id: randomId(),
			name,
			age: ageFromBirthdate(newBirthdate),
			color: newColor,
			avatarEmoji: newAvatar
		};
		draft.profiles.push(p);
		newName = '';
		newBirthdate = defaultBirthdate();
		newColor = suggestColor();
		newAvatar = AVATAR_CHOICES[(draft.profiles.length * 2) % AVATAR_CHOICES.length];
		personKeyboardOpen = false;
		justAdded = name;
		clearTimeout(justAddedTimer);
		justAddedTimer = setTimeout(() => (justAdded = ''), 2500);
		await tick();
		document
			.getElementById(`person-${p.id}`)
			?.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}
	function removeProfile(id: string) {
		const i = draft.profiles.findIndex((p) => p.id === id);
		if (i >= 0) draft.profiles.splice(i, 1);
	}

	const canLeaveStep1 = $derived(draft.family.name.trim().length > 0);
	const canFinish = $derived(canLeaveStep1 && draft.profiles.length > 0);

	function next() {
		if (step < 3) step += 1;
	}
	function back() {
		if (step > 1) step -= 1;
	}

	async function finish() {
		if (!canFinish) return;
		saving = true;
		errorMsg = '';
		try {
			const res = await fetch('/setup/complete', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ token, draft: $state.snapshot(draft) })
			});
			if (!res.ok) throw new Error(await res.text());
			oncomplete(draft.family.name);
		} catch (e) {
			errorMsg = e instanceof Error ? e.message : 'Something went wrong. Please try again.';
		} finally {
			saving = false;
		}
	}
</script>

<div class="wizard">
	<header class="whead">
		<span class="brand type-label">Family Calendar setup</span>
		<div class="steps" aria-hidden="true">
			{#each [1, 2, 3] as s (s)}
				<span class="pip" class:on={s <= step}></span>
			{/each}
		</div>
	</header>

	{#if step === 1}
		<section class="panel">
			<h1 class="type-title">Your family</h1>
			<label class="field">
				<span class="type-label">Family name</span>
				<!-- svelte-ignore a11y_autofocus -->
				<input
					class="input"
					type="text"
					readonly
					placeholder="e.g. The Sharma Family"
					value={draft.family.name}
					onclick={() => (nameKeyboardOpen = true)}
					maxlength="60"
				/>
			</label>
			{#if nameKeyboardOpen}
				<OnScreenKeyboard
					bind:value={draft.family.name}
					onenter={() => (nameKeyboardOpen = false)}
					onclose={() => (nameKeyboardOpen = false)}
				/>
			{/if}

			<label class="field">
				<span class="type-label">Time zone</span>
				<select class="input" bind:value={draft.family.timezone}>
					{#each timezones as tz (tz)}
						<option value={tz}>{tz}</option>
					{/each}
				</select>
			</label>

			<div class="field">
				<span class="type-label">Week starts on</span>
				<div class="segmented">
					<button
						type="button"
						class="seg"
						class:on={draft.family.weekStartsOn === 1}
						onclick={() => (draft.family.weekStartsOn = 1)}>Monday</button
					>
					<button
						type="button"
						class="seg"
						class:on={draft.family.weekStartsOn === 0}
						onclick={() => (draft.family.weekStartsOn = 0)}>Sunday</button
					>
				</div>
			</div>
		</section>
	{:else if step === 2}
		<section class="panel">
			<h1 class="type-title">Add people</h1>
			<p class="type-body sub">Everyone who shares the calendar. You can add more later.</p>

			{#if draft.profiles.length}
				<ul class="people">
					{#each draft.profiles as p (p.id)}
						<li id="person-{p.id}" class="person" style:background={profileTint(p.color, 30)}>
							<span class="pav" style:background={profileTint(p.color, 55)}>{p.avatarEmoji}</span>
							<span class="pinfo">
								<span class="type-label">{p.name}</span>
								<span class="type-caption">{p.age} yrs</span>
							</span>
							<button
								type="button"
								class="remove"
								aria-label="Remove {p.name}"
								onclick={() => removeProfile(p.id)}
							>
								<X size={18} />
							</button>
						</li>
					{/each}
				</ul>
			{/if}

			<div class="addform">
				<label class="field">
					<span class="type-label">Name</span>
					<input
						class="input"
						type="text"
						readonly
						placeholder="Name"
						value={newName}
						onclick={() => (personKeyboardOpen = true)}
						maxlength="40"
					/>
				</label>
				{#if personKeyboardOpen}
					<OnScreenKeyboard
						bind:value={newName}
						onenter={() => (personKeyboardOpen = false)}
						onclose={() => (personKeyboardOpen = false)}
					/>
				{/if}

				<label class="field">
					<span class="type-label">Date of birth</span>
					<input class="input" type="date" max={todayStr} bind:value={newBirthdate} />
					<span class="type-caption agehint">{ageFromBirthdate(newBirthdate)} years old</span>
				</label>

				<div class="picker">
					<span class="type-caption plabel">Color</span>
					<div class="swatches">
						{#each PROFILE_COLORS as c (c)}
							<button
								type="button"
								class="swatch"
								class:on={newColor === c}
								style:background={profileColorVar(c)}
								aria-label={c}
								onclick={() => (newColor = c)}
							></button>
						{/each}
					</div>
				</div>

				<div class="picker">
					<span class="type-caption plabel">Avatar</span>
					<div class="avatars">
						{#each AVATAR_CHOICES as a (a)}
							<button
								type="button"
								class="avatarbtn"
								class:on={newAvatar === a}
								onclick={() => (newAvatar = a)}>{a}</button
							>
						{/each}
					</div>
				</div>

				<button type="button" class="addbtn" disabled={!newName.trim()} onclick={addProfile}>
					<Plus size={18} /> Add person
				</button>
				{#if justAdded}
					<p class="addedhint type-label"><Check size={16} /> Added {justAdded}</p>
				{/if}
			</div>
		</section>
	{:else}
		<section class="panel">
			<h1 class="type-title">Review</h1>
			<div class="review">
				<div class="rrow">
					<span class="type-label rk">Family</span><span class="type-body-lg"
						>{draft.family.name}</span
					>
				</div>
				<div class="rrow">
					<span class="type-label rk">Time zone</span><span class="type-body"
						>{draft.family.timezone}</span
					>
				</div>
				<div class="rrow">
					<span class="type-label rk">People</span>
					<div class="rpeople">
						{#each draft.profiles as p (p.id)}
							<span class="chip" style:background={profileTint(p.color, 40)}
								>{p.avatarEmoji} {p.name}</span
							>
						{/each}
					</div>
				</div>
			</div>
			{#if errorMsg}<p class="err type-label">{errorMsg}</p>{/if}
		</section>
	{/if}

	<footer class="nav">
		{#if step > 1}
			<button type="button" class="btn ghost" onclick={back}><ChevronLeft size={18} /> Back</button>
		{:else}
			<span></span>
		{/if}

		{#if step < 3}
			<button
				type="button"
				class="btn primary"
				disabled={step === 1 && !canLeaveStep1}
				onclick={next}
			>
				Next <ChevronRight size={18} />
			</button>
		{:else}
			<button type="button" class="btn primary" disabled={!canFinish || saving} onclick={finish}>
				{saving ? 'Saving…' : 'Finish setup'}
			</button>
		{/if}
	</footer>
</div>

<style>
	.wizard {
		width: min(560px, 100%);
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding: var(--space-5);
		border-radius: var(--radius-xl);
		background: var(--color-surface);
		box-shadow: var(--shadow-float);
	}
	.whead {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.brand {
		color: var(--color-text-tertiary);
	}
	.steps {
		display: flex;
		gap: 6px;
	}
	.pip {
		width: 22px;
		height: 6px;
		border-radius: var(--radius-pill);
		background: var(--color-border-subtle);
	}
	.pip.on {
		background: var(--color-text-primary);
	}
	.panel {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	.sub {
		color: var(--color-text-secondary);
		margin-top: -8px;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.field > .type-label {
		color: var(--color-text-secondary);
	}
	.input {
		width: 100%;
		padding: 14px;
		font-size: var(--text-lg);
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border-subtle);
		background: var(--color-surface);
		color: var(--color-text-primary);
	}
	.segmented {
		display: flex;
		gap: 6px;
		padding: 4px;
		background: var(--color-surface-elevated);
		border-radius: var(--radius-pill);
	}
	.seg {
		flex: 1;
		padding: 12px;
		border-radius: var(--radius-pill);
		font-weight: var(--weight-medium);
		color: var(--color-text-secondary);
	}
	.seg.on {
		background: var(--color-surface);
		color: var(--color-text-primary);
		box-shadow: var(--shadow-card);
	}
	.people {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		max-height: 30vh;
		overflow-y: auto;
	}
	.person {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: 8px 10px;
		border-radius: var(--radius-md);
	}
	.pav {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: var(--radius-pill);
		font-size: 1.3rem;
	}
	.pinfo {
		flex: 1;
		display: flex;
		flex-direction: column;
	}
	.remove {
		display: grid;
		place-items: center;
		width: 38px;
		height: 38px;
		border-radius: var(--radius-pill);
		color: var(--color-text-secondary);
		background: rgba(255, 255, 255, 0.5);
	}
	.addform {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-4);
		border-radius: var(--radius-lg);
		background: var(--color-surface-elevated);
	}
	.agehint {
		color: var(--color-text-secondary);
	}
	.picker {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.plabel {
		color: var(--color-text-tertiary);
	}
	.swatches {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	.swatch {
		width: 38px;
		height: 38px;
		border-radius: var(--radius-pill);
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06);
	}
	.swatch.on {
		box-shadow: 0 0 0 3px var(--color-text-primary);
	}
	.avatars {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}
	.avatarbtn {
		width: 46px;
		height: 46px;
		border-radius: var(--radius-md);
		font-size: 1.4rem;
		background: var(--color-surface);
	}
	.avatarbtn.on {
		box-shadow: 0 0 0 2px var(--color-text-primary);
	}
	.addbtn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 14px;
		border-radius: var(--radius-md);
		background: var(--color-surface);
		color: var(--color-text-primary);
		font-weight: var(--weight-semibold);
		box-shadow: var(--shadow-card);
	}
	.addbtn:disabled {
		opacity: 0.5;
	}
	.addedhint {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		margin: 0;
		color: var(--color-accent-success);
	}
	.review {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding: var(--space-4);
		border-radius: var(--radius-lg);
		background: var(--color-surface-elevated);
	}
	.rrow {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.rk {
		color: var(--color-text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.rpeople {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}
	.chip {
		padding: 6px 12px;
		border-radius: var(--radius-pill);
		font-weight: var(--weight-medium);
	}
	.err {
		color: var(--color-accent-warning);
	}
	.nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding-top: var(--space-2);
	}
	.btn {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 14px 22px;
		border-radius: var(--radius-pill);
		font-weight: var(--weight-semibold);
		font-size: var(--text-lg);
	}
	.btn.primary {
		background: var(--color-text-primary);
		color: var(--color-surface);
	}
	.btn.ghost {
		background: var(--color-surface-elevated);
		color: var(--color-text-primary);
	}
	.btn:disabled {
		opacity: 0.45;
	}
</style>
