<script lang="ts">
	/**
	 * Shows the password-recovery code on the display.
	 *
	 * Only the kiosk can render this: /api/recovery/code answers loopback
	 * requests and refuses everything else, so on a phone or laptop the first
	 * poll comes back 403 and this component stops asking and stays invisible.
	 * That refusal is the entire proof-of-presence — the code exists on the
	 * screen in the room and nowhere else.
	 */
	import { onMount } from 'svelte';

	let code = $state<string | null>(null);
	let expiresAt = $state(0);
	let now = $state(Date.now());

	const secondsLeft = $derived(Math.max(0, Math.ceil((expiresAt - now) / 1000)));

	onMount(() => {
		let stopped = false;
		let timer: ReturnType<typeof setTimeout>;

		const poll = async () => {
			if (stopped) return;
			try {
				const r = await fetch('/api/recovery/code');
				if (r.status === 403) {
					// Not the kiosk. Nothing here will ever be shown, so stop.
					stopped = true;
					return;
				}
				const d = await r.json();
				code = d?.active ? d.code : null;
				expiresAt = d?.expiresAt ?? 0;
			} catch {
				/* transient; try again on the next tick */
			}
			timer = setTimeout(poll, 4000);
		};
		poll();

		const tick = setInterval(() => (now = Date.now()), 1000);
		return () => {
			stopped = true;
			clearTimeout(timer);
			clearInterval(tick);
		};
	});
</script>

{#if code && secondsLeft > 0}
	<div class="overlay" role="status" aria-live="polite">
		<div class="panel">
			<p class="type-label lead">Device password recovery</p>
			<p class="digits">{code}</p>
			<p class="type-body sub">
				Type this code on the phone or tablet that asked for it. It is only shown here, on this
				screen.
			</p>
			<p class="type-caption sub">Expires in {secondsLeft}s</p>
		</div>
	</div>
{/if}

<style>
	.overlay {
		position: fixed;
		inset: 0;
		z-index: 80;
		display: grid;
		place-items: center;
		background: rgba(0, 0, 0, 0.72);
		backdrop-filter: blur(3px);
	}
	.panel {
		text-align: center;
		padding: var(--space-6) var(--space-7);
		border-radius: var(--radius-xl);
		background: var(--color-surface);
		box-shadow: var(--shadow-card);
		max-width: 620px;
	}
	.lead {
		color: var(--color-text-secondary);
	}
	.digits {
		margin: var(--space-3) 0;
		font-size: clamp(4rem, 18vw, 9rem);
		font-weight: var(--weight-semibold);
		letter-spacing: 0.16em;
		/* Tabular figures stop the code jittering as it re-renders. */
		font-variant-numeric: tabular-nums;
		color: var(--color-text-primary);
	}
	.sub {
		color: var(--color-text-secondary);
	}
</style>
