<script lang="ts">
	import type { Profile } from '$lib/types';
	import { profileColorVar, profileTint } from '$lib/design/colors';

	let {
		profile,
		size = 36,
		ring = true
	}: { profile: Profile; size?: number; ring?: boolean } = $props();

	// Fall back to the emoji if the photo fails to load.
	let photoFailed = $state(false);
	const showPhoto = $derived(!!profile.photoUpdatedAt && !photoFailed);
</script>

<span
	class="avatar"
	style:width="{size}px"
	style:height="{size}px"
	style:font-size="{Math.round(size * 0.58)}px"
	style:background={profileTint(profile.color, 55)}
	style:box-shadow={ring ? `0 0 0 2px ${profileColorVar(profile.color)}` : 'none'}
	title={profile.name}
>
	{#if showPhoto}
		<img
			class="photo"
			src="/media/avatar/{profile.id}?v={profile.photoUpdatedAt}"
			alt={profile.name}
			onerror={() => (photoFailed = true)}
		/>
	{:else}
		{profile.avatarEmoji}
	{/if}
</span>

<style>
	.avatar {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-pill);
		line-height: 1;
		flex: none;
		user-select: none;
		overflow: hidden;
	}
	.photo {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
</style>
