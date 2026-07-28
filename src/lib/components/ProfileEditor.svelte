<script lang="ts">
	import { family } from '$lib/stores/family.svelte';
	import type { Profile, ProfileColor } from '$lib/types';
	import { PROFILE_COLORS, profileColorVar } from '$lib/design/colors';
	import { AVATAR_CHOICES } from '$lib/setup/types';
	import Avatar from './Avatar.svelte';
	import { Camera, X, Plus } from 'lucide-svelte';

	let { onChange }: { onChange: () => void } = $props();

	let uploadingId = $state<number | null>(null);

	async function uploadPhoto(profile: Profile, file: File) {
		uploadingId = profile.id;
		try {
			const res = await fetch(`/api/avatar/${profile.id}`, {
				method: 'POST',
				headers: { 'content-type': file.type },
				body: file
			});
			if (res.ok) {
				const { photoUpdatedAt } = await res.json();
				profile.photoUpdatedAt = photoUpdatedAt;
				onChange();
			}
		} finally {
			uploadingId = null;
		}
	}

	function onFile(profile: Profile, e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (file) uploadPhoto(profile, file);
		input.value = '';
	}

	function setColor(profile: Profile, c: ProfileColor) {
		profile.color = c;
		onChange();
	}

	function removeProfile(id: number) {
		const i = family.data.profiles.findIndex((p) => p.id === id);
		if (i >= 0) family.data.profiles.splice(i, 1);
		onChange();
	}

	// Add-person form
	let newName = $state('');
	let newAge = $state<number | null>(null);
	let newColor = $state<ProfileColor>('pink');
	let newAvatar = $state<string>(AVATAR_CHOICES[0]);

	function addProfile() {
		const name = newName.trim();
		if (!name || newAge === null) return;
		const id = family.data.profiles.reduce((m, p) => Math.max(m, p.id), 0) + 1;
		family.data.profiles.push({
			id,
			name,
			age: Number(newAge),
			role: Number(newAge) >= 18 ? 'parent' : 'child',
			color: newColor,
			avatarEmoji: newAvatar,
			tasks: { done: 0, total: 0 }
		});
		newName = '';
		newAge = null;
		onChange();
	}
</script>

<div class="editor">
	{#each family.profiles as p (p.id)}
		<div class="prow">
			<label class="avwrap" title="Upload a photo for {p.name}">
				<Avatar profile={p} size={52} />
				<span class="camera" class:busy={uploadingId === p.id}><Camera size={13} /></span>
				<input type="file" accept="image/*" onchange={(e) => onFile(p, e)} hidden />
			</label>

			<div class="fields">
				<input class="name" type="text" bind:value={p.name} oninput={onChange} maxlength="40" />
				<div class="swatches">
					{#each PROFILE_COLORS as c (c)}
						<button
							type="button"
							class="swatch"
							class:on={p.color === c}
							style:background={profileColorVar(c)}
							aria-label={c}
							onclick={() => setColor(p, c)}
						></button>
					{/each}
				</div>
			</div>

			<button
				type="button"
				class="remove"
				aria-label="Remove {p.name}"
				onclick={() => removeProfile(p.id)}
			>
				<X size={16} />
			</button>
		</div>
	{/each}

	<div class="addrow">
		<input class="name" type="text" placeholder="Name" bind:value={newName} maxlength="40" />
		<input class="age" type="number" placeholder="Age" min="0" max="120" bind:value={newAge} />
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
		<button
			type="button"
			class="add"
			disabled={!newName.trim() || newAge === null}
			onclick={addProfile}
		>
			<Plus size={16} /> Add
		</button>
	</div>
</div>

<style>
	.editor {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.prow {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.avwrap {
		position: relative;
		flex: none;
		cursor: pointer;
	}
	.camera {
		position: absolute;
		right: -2px;
		bottom: -2px;
		display: grid;
		place-items: center;
		width: 22px;
		height: 22px;
		border-radius: var(--radius-pill);
		background: var(--color-text-primary);
		color: white;
		box-shadow: 0 0 0 2px var(--color-surface);
	}
	.camera.busy {
		opacity: 0.5;
	}
	.fields {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-width: 0;
	}
	.name {
		padding: 8px 12px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-border-subtle);
		background: var(--color-surface);
		color: var(--color-text-primary);
		font-size: var(--text-base);
		font-weight: var(--weight-medium);
	}
	.swatches {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}
	.swatch {
		width: 24px;
		height: 24px;
		border-radius: var(--radius-pill);
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06);
	}
	.swatch.on {
		box-shadow: 0 0 0 2px var(--color-text-primary);
	}
	.remove {
		display: grid;
		place-items: center;
		width: 34px;
		height: 34px;
		flex: none;
		border-radius: var(--radius-pill);
		color: var(--color-text-tertiary);
		background: var(--color-surface-elevated);
	}
	.addrow {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex-wrap: wrap;
		padding-top: var(--space-3);
		border-top: 1px solid var(--color-border-hairline);
	}
	.addrow .name {
		flex: 1;
		min-width: 120px;
	}
	.age {
		width: 80px;
		padding: 8px 12px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-border-subtle);
		background: var(--color-surface);
		color: var(--color-text-primary);
	}
	.add {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 8px 14px;
		border-radius: var(--radius-pill);
		background: var(--color-text-primary);
		color: var(--color-surface);
		font-weight: var(--weight-semibold);
	}
	.add:disabled {
		opacity: 0.45;
	}
</style>
