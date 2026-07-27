<script lang="ts">
	import type { RoutineStep, ProfileColor } from '$lib/types';
	import { profileColorVar } from '$lib/design/colors';
	import RoutineIcon from '$lib/icons/RoutineIcon.svelte';
	import { Check } from 'lucide-svelte';

	let {
		step,
		color,
		showText = true,
		onToggle
	}: {
		step: RoutineStep;
		color: ProfileColor;
		showText?: boolean;
		onToggle: () => void;
	} = $props();
</script>

<button
	type="button"
	class="step pressable"
	class:done={step.done}
	class:icononly={!showText}
	style:--accent={profileColorVar(color)}
	onclick={onToggle}
	aria-pressed={step.done}
	aria-label={step.label}
>
	<span class="icon">
		<RoutineIcon icon={step.icon} size={showText ? 40 : 56} />
	</span>
	{#if showText}
		<span class="meta">
			<span class="label type-body-lg">{step.label}</span>
			<span class="mins type-caption">{step.estimatedMinutes} min</span>
		</span>
	{/if}
	<span class="check" aria-hidden="true">
		{#if step.done}<Check size={showText ? 22 : 30} strokeWidth={3} />{/if}
	</span>
</button>

<style>
	.step {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		width: 100%;
		min-height: var(--touch-kid);
		padding: var(--space-4);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
		box-shadow: var(--shadow-card);
		text-align: left;
		transition:
			transform var(--dur-quick) var(--ease-out),
			background var(--dur-standard) var(--ease-out),
			box-shadow var(--dur-quick) var(--ease-out);
	}
	.step.icononly {
		flex-direction: column;
		justify-content: center;
		gap: var(--space-2);
		min-height: 128px;
		text-align: center;
	}
	.icon {
		display: grid;
		place-items: center;
		width: 64px;
		height: 64px;
		flex: none;
		border-radius: var(--radius-md);
		color: color-mix(in srgb, var(--accent) 60%, #1a1a1a);
		background: color-mix(in srgb, var(--accent) 40%, white);
	}
	.icononly .icon {
		width: 84px;
		height: 84px;
	}
	.meta {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
	}
	.label {
		color: var(--color-text-primary);
	}
	.mins {
		color: var(--color-text-tertiary);
	}
	.check {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		flex: none;
		border-radius: var(--radius-pill);
		border: 2px solid var(--color-border-subtle);
		color: white;
		transition: all var(--dur-standard) var(--ease-spring-bounce);
	}
	.icononly .check {
		position: absolute;
		top: 10px;
		right: 10px;
	}
	.icononly {
		position: relative;
	}

	/* Completed state */
	.step.done {
		background: color-mix(in srgb, var(--color-accent-success) 18%, white);
	}
	.step.done .icon {
		color: var(--color-accent-success);
		background: color-mix(in srgb, var(--color-accent-success) 22%, white);
	}
	.step.done .check {
		background: var(--color-accent-success);
		border-color: var(--color-accent-success);
	}
	.step.done .label {
		color: var(--color-text-secondary);
		text-decoration: line-through;
		text-decoration-color: color-mix(in srgb, var(--color-text-secondary) 45%, transparent);
	}
</style>
