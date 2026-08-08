<script lang="ts">
	/**
	 * First screen on a brand-new device: is this a TV or a touchscreen?
	 *
	 * Everything after this depends on the answer, so it has to come first — but
	 * on a TV nobody can tap to answer. So TV is preselected and confirms itself
	 * after a countdown: doing nothing gives the right result on a TV, while a
	 * touchscreen user simply taps before the timer runs out.
	 */
	import { Tv, Hand } from 'lucide-svelte';

	let { onchoose }: { onchoose: (mode: 'tv' | 'touch') => void } = $props();

	const TIMEOUT_SECONDS = 30;
	let remaining = $state(TIMEOUT_SECONDS);
	let choosing = $state(false);
	/** Someone is clearly present — stop counting down and let them decide. */
	let cancelled = $state(false);

	function choose(mode: 'tv' | 'touch') {
		if (choosing) return;
		choosing = true;
		onchoose(mode);
	}

	$effect(() => {
		// Depending on `cancelled` means setting it tears the interval down, rather
		// than leaving it running to fire a choice nobody asked for.
		if (cancelled) return;
		const id = setInterval(() => {
			remaining -= 1;
			if (remaining <= 0) {
				clearInterval(id);
				choose('tv');
			}
		}, 1000);
		return () => clearInterval(id);
	});

	// Any tap or key means someone can interact — stop the auto-confirm so they
	// aren't rushed into the wrong mode.
	function cancelTimer() {
		cancelled = true;
	}
</script>

<svelte:window onpointerdown={cancelTimer} onkeydown={cancelTimer} />

<div class="picker">
	<header class="brand">
		<span class="logo">🗓️</span>
		<div>
			<h1 class="type-title-lg">Family Calendar</h1>
			<p class="type-body-lg sub">How is this screen set up?</p>
		</div>
	</header>

	<div class="choices">
		<button type="button" class="choice tv" onclick={() => choose('tv')}>
			<Tv size={56} />
			<span class="type-title">TV / Monitor</span>
			<span class="type-body sub">
				No touch. You'll set things up from your phone by scanning a QR code.
			</span>
			{#if !cancelled && remaining > 0}
				<span class="auto">Continuing automatically in {remaining}s</span>
			{:else}
				<span class="auto muted">Recommended for TVs</span>
			{/if}
		</button>

		<button type="button" class="choice" onclick={() => choose('touch')}>
			<Hand size={56} />
			<span class="type-title">Touchscreen</span>
			<span class="type-body sub">
				You can tap this screen. Set everything up right here, no phone needed.
			</span>
			<span class="auto muted">Tap here if this screen responds to touch</span>
		</button>
	</div>

	<p class="type-caption foot">You can change this later in Settings.</p>
</div>

<style>
	.picker {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: clamp(20px, 4vh, 44px);
		padding: 4vmin;
		background: linear-gradient(135deg, #fdf3f7 0%, var(--color-canvas) 45%, #eef6fb 100%);
	}
	.brand {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.logo {
		font-size: 2.8rem;
	}
	.sub {
		color: var(--color-text-secondary);
	}
	.choices {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: clamp(16px, 3vw, 32px);
		width: min(900px, 100%);
	}
	.choice {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		/* Large targets: this may be the only thing a finger has to hit. */
		padding: clamp(24px, 4vmin, 44px) clamp(18px, 3vmin, 32px);
		border-radius: var(--radius-xl);
		background: var(--color-surface);
		box-shadow: var(--shadow-card);
		color: var(--color-text-secondary);
		text-align: center;
	}
	.choice :global(svg) {
		color: var(--color-text-primary);
	}
	.choice .type-title {
		color: var(--color-text-primary);
	}
	.choice:active {
		transform: translateY(1px);
	}
	.choice.tv {
		box-shadow:
			var(--shadow-float),
			0 0 0 3px var(--color-profile-blue);
	}
	.auto {
		margin-top: 4px;
		font-size: var(--text-sm);
		font-weight: var(--weight-semibold);
		color: var(--color-profile-blue);
	}
	.auto.muted {
		color: var(--color-text-tertiary);
		font-weight: var(--weight-medium);
	}
	.foot {
		color: var(--color-text-tertiary);
	}
	/* A portrait screen is almost always narrow too, so auto-fit would already
	   collapse this — but detecting orientation directly (rather than relying on
	   that incidental width crossover) is what actually answers "is this screen
	   mounted upright," which is the thing that matters here. */
	@media (orientation: portrait) {
		.choices {
			grid-template-columns: 1fr;
		}
	}
</style>
