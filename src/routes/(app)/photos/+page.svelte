<script lang="ts">
	import { Image } from 'lucide-svelte';
</script>

<div class="photos-page">
	<h1 class="type-title page-title">Photos</h1>
	<div class="soon">
		<div class="icon"><Image size={34} /></div>
		<p class="type-heading">Photo albums are coming soon</p>
		<p class="type-body sub">
			Upload family photos to show as a screensaver and browse here. Until then, the clock
			screensaver runs on the display.
		</p>
		<a class="link type-label" href="/sleep">Screensaver settings →</a>
	</div>
</div>

<style>
	.photos-page {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding-top: var(--space-2);
	}
	.page-title {
		color: var(--color-text-primary);
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
</style>
