<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { Image, Upload, Trash2 } from 'lucide-svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let uploading = $state(false);
	let uploadError = $state('');

	async function uploadFiles(files: FileList | null) {
		if (!files || files.length === 0) return;
		uploading = true;
		uploadError = '';
		try {
			for (const file of files) {
				if (!file.type.startsWith('image/')) continue;
				const res = await fetch('/api/photos', {
					method: 'POST',
					headers: { 'content-type': file.type },
					body: file
				});
				if (!res.ok) {
					uploadError = 'Could not upload one or more photos.';
				}
			}
			await invalidateAll();
		} finally {
			uploading = false;
		}
	}

	function onFile(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		uploadFiles(input.files);
		input.value = '';
	}

	let dragOver = $state(false);
	function onDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		uploadFiles(e.dataTransfer?.files ?? null);
	}

	let removingId = $state<number | null>(null);
	async function removePhoto(id: number) {
		removingId = id;
		try {
			await fetch(`/api/photos/${id}`, { method: 'DELETE' });
			await invalidateAll();
		} finally {
			removingId = null;
		}
	}
</script>

<div class="photos-page">
	<div class="pagehead">
		<h1 class="type-title page-title">Photos</h1>
		<label class="uploadbtn pressable" class:busy={uploading}>
			<Upload size={16} />
			{uploading ? 'Uploading…' : 'Upload'}
			<input type="file" accept="image/*" multiple onchange={onFile} hidden disabled={uploading} />
		</label>
	</div>

	{#if uploadError}<p class="type-caption err">{uploadError}</p>{/if}

	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="dropzone"
		class:over={dragOver}
		ondragover={(e) => {
			e.preventDefault();
			dragOver = true;
		}}
		ondragleave={() => (dragOver = false)}
		ondrop={onDrop}
	>
		{#if data.photos.length === 0}
			<div class="soon">
				<div class="icon"><Image size={34} /></div>
				<p class="type-heading">No photos yet</p>
				<p class="type-body sub">
					Upload family photos to browse here, and show as a screensaver. Drag and drop, or use
					the Upload button above.
				</p>
				<a class="link type-label" href="/sleep">Screensaver settings →</a>
			</div>
		{:else}
			<div class="grid">
				{#each data.photos as photo (photo.id)}
					<div class="tile">
						<img src="/media/photo/{photo.id}" alt="" loading="lazy" />
						<button
							type="button"
							class="remove"
							aria-label="Remove photo"
							disabled={removingId === photo.id}
							onclick={() => removePhoto(photo.id)}
						>
							<Trash2 size={15} />
						</button>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.photos-page {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding-top: var(--space-2);
	}
	.pagehead {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.page-title {
		color: var(--color-text-primary);
	}
	.uploadbtn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 10px 16px;
		border-radius: var(--radius-pill);
		background: var(--color-text-primary);
		color: var(--color-surface);
		font-weight: var(--weight-semibold);
		cursor: pointer;
	}
	.uploadbtn.busy {
		opacity: 0.6;
		pointer-events: none;
	}
	.err {
		color: var(--color-accent-warning);
	}
	.dropzone {
		border-radius: var(--radius-lg);
		transition: box-shadow var(--dur-quick) var(--ease-out);
	}
	.dropzone.over {
		box-shadow: 0 0 0 3px var(--color-accent-success);
	}
	.soon {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		gap: var(--space-2);
		padding: var(--space-8) var(--space-4);
		background: var(--color-surface);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-card);
		max-width: 460px;
		margin: 0 auto;
	}
	.icon {
		display: grid;
		place-items: center;
		width: 64px;
		height: 64px;
		border-radius: var(--radius-pill);
		background: var(--color-surface-elevated);
		color: var(--color-text-secondary);
	}
	.sub {
		color: var(--color-text-secondary);
	}
	.link {
		margin-top: var(--space-2);
		color: var(--color-text-primary);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
		gap: var(--space-3);
	}
	.tile {
		position: relative;
		aspect-ratio: 1;
		border-radius: var(--radius-md);
		overflow: hidden;
		background: var(--color-surface-elevated);
		box-shadow: var(--shadow-card);
	}
	.tile img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.remove {
		position: absolute;
		top: 6px;
		right: 6px;
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		border-radius: var(--radius-pill);
		background: rgba(20, 20, 20, 0.55);
		color: white;
		opacity: 0;
		transition: opacity var(--dur-quick) var(--ease-out);
	}
	.tile:hover .remove,
	.tile:focus-within .remove {
		opacity: 1;
	}
	.remove:disabled {
		opacity: 1;
		cursor: default;
	}
</style>
