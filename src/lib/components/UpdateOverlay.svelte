<script lang="ts">
	/**
	 * Full-screen takeover while an update is installing — on whichever screen
	 * happens to be looking (TV or phone), since the person in the room should
	 * see why the display is about to go sluggish/dark for a minute, not just
	 * whoever is sitting in Settings. Modelled on how a set-top box (Apple TV,
	 * a game console) shows a software update: download, then install, then an
	 * explicit "applying — restarting" step, never silently in the background.
	 *
	 * Mounted once, globally, in the root layout — not gated by route, so it
	 * follows the kiosk from whatever it was showing.
	 */
	import Spinner from './Spinner.svelte';
	import { Download, PackageCheck, RotateCw, CircleCheck, CircleAlert } from 'lucide-svelte';

	interface UpdateState {
		status: 'idle' | 'available' | 'installing' | 'failed';
		error?: string;
		progress?: number;
		installedAt?: number;
	}

	let update = $state<UpdateState | null>(null);

	/**
	 * Only ever shown for an install THIS poll loop actually watched happen —
	 * never for a stale 'failed' from a routine background check (e.g. last
	 * week's "could not reach GitHub") that happens to be sitting in
	 * update-state.json on an ordinary page load. Becomes true the moment
	 * status is first observed as 'installing', and only ever resets when the
	 * person dismisses a failure or the success screen reloads the page.
	 */
	let watching = $state(false);
	let dismissedFailure = $state(false);
	let reloadTimer: ReturnType<typeof setTimeout>;

	async function poll() {
		try {
			const r = await fetch('/api/update');
			if (r.ok) {
				const d = await r.json();
				update = d.update ?? null;
				if (update?.status === 'installing') {
					watching = true;
					dismissedFailure = false;
				}
			}
		} catch {
			/* transient — next tick retries; never tear down the overlay over a
			   single missed poll, since the service restart this overlay is
			   showing is EXACTLY when a request is most likely to drop */
		}
	}

	$effect(() => {
		poll();
		// Faster than Settings' own 5s poll (which is a quiet inline row this
		// overlay coexists with) — this IS the primary way to watch progress
		// now, so it should feel responsive.
		const id = setInterval(poll, 2000);
		return () => {
			clearInterval(id);
			clearTimeout(reloadTimer);
		};
	});

	const showInstalling = $derived(watching && update?.status === 'installing');
	const showFailed = $derived(watching && update?.status === 'failed' && !dismissedFailure);
	const justSucceeded = $derived(
		watching &&
			update?.status === 'idle' &&
			!!update.installedAt &&
			Date.now() - update.installedAt < 15_000
	);

	// Reload once, automatically, on success — the bundle this page already
	// loaded may not match the server that just replaced it underneath it,
	// which otherwise surfaces later as a confusing, unrelated-looking error.
	let reloadQueued = false;
	$effect(() => {
		if (!justSucceeded || reloadQueued) return;
		reloadQueued = true;
		reloadTimer = setTimeout(() => location.reload(), 2200);
	});

	/**
	 * update.sh's checkpoints (5 / 10 / 30 / 45 / 85 / 95 / 100) are coarse and
	 * real — each marks a step that actually finished, not a smooth fake
	 * animation — but they're one continuous number across three logically
	 * different phases. Slicing by the known boundaries and rescaling each
	 * slice to its own 0–100 gives the three-phase feel being asked for
	 * (download fills up, THEN install fills up, THEN restart) without
	 * inventing a second data source update.sh doesn't have.
	 */
	type Phase = { key: 'download' | 'install' | 'restart'; label: string; icon: typeof Download };
	const PHASES: { max: number; phase: Phase }[] = [
		{ max: 10, phase: { key: 'download', label: 'Downloading update', icon: Download } },
		{ max: 85, phase: { key: 'install', label: 'Installing', icon: PackageCheck } },
		{ max: 100, phase: { key: 'restart', label: 'Restarting to apply the update', icon: RotateCw } }
	];
	const current = $derived.by(() => {
		const raw = update?.progress ?? 0;
		let prevMax = 0;
		for (const { max, phase } of PHASES) {
			if (raw <= max) {
				const span = max - prevMax;
				const pct = span > 0 ? Math.round(((raw - prevMax) / span) * 100) : 100;
				return { phase, pct: Math.min(100, Math.max(0, pct)) };
			}
			prevMax = max;
		}
		return { phase: PHASES[PHASES.length - 1].phase, pct: 100 };
	});
</script>

{#if showInstalling || showFailed || justSucceeded}
	<div class="overlay" role="status" aria-live="polite">
		<div class="panel">
			{#if showFailed}
				<CircleAlert size={48} class="icon err" />
				<h1 class="type-title">Update failed</h1>
				<p class="type-body sub">
					{update?.error ??
						'Something went wrong. The device is back on the version it was running before.'}
				</p>
				<button type="button" class="dismiss" onclick={() => (dismissedFailure = true)}>
					OK
				</button>
			{:else if justSucceeded}
				<CircleCheck size={48} class="icon ok" />
				<h1 class="type-title">Updated</h1>
				<p class="type-body sub">Reloading…</p>
			{:else}
				{@const Ico = current.phase.icon}
				<div class="iconwrap">
					<Ico size={40} strokeWidth={1.8} />
				</div>
				<h1 class="type-title">{current.phase.label}</h1>
				<div class="barrow">
					<div class="bartrack">
						<div class="barfill" style:width="{current.pct}%"></div>
					</div>
					<span class="pct type-label">{current.pct}%</span>
				</div>
				{#if current.phase.key === 'restart'}
					<p class="type-caption sub">
						The display will go blank for a few seconds while the app restarts. This is expected —
						don't unplug it.
					</p>
				{:else}
					<p class="type-caption sub">
						<Spinner size={13} label="Working" /> This can take a few minutes.
					</p>
				{/if}
			{/if}
		</div>
	</div>
{/if}

<style>
	.overlay {
		position: fixed;
		inset: 0;
		z-index: 300;
		display: grid;
		place-items: center;
		background: color-mix(in srgb, var(--color-canvas, #0b0b0c) 92%, black);
		padding: var(--space-5);
	}
	.panel {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3);
		max-width: 420px;
		text-align: center;
	}
	.panel :global(h1) {
		color: var(--color-text-primary, #fff);
	}
	.sub {
		color: var(--color-text-secondary, #a0a0a5);
	}
	.iconwrap {
		display: grid;
		place-items: center;
		width: 72px;
		height: 72px;
		border-radius: var(--radius-pill);
		background: color-mix(in srgb, var(--color-text-primary, #fff) 10%, transparent);
		color: var(--color-text-primary, #fff);
	}
	:global(.icon.ok) {
		color: var(--color-accent-success, #34c759);
	}
	:global(.icon.err) {
		color: var(--color-accent-warning, #ff6b6b);
	}
	.barrow {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		width: 100%;
	}
	.bartrack {
		flex: 1;
		height: 10px;
		border-radius: var(--radius-pill);
		background: color-mix(in srgb, var(--color-text-primary, #fff) 14%, transparent);
		overflow: hidden;
	}
	.barfill {
		height: 100%;
		border-radius: var(--radius-pill);
		background: var(--color-text-primary, #fff);
		transition: width 0.6s ease;
	}
	.pct {
		min-width: 3ch;
		text-align: right;
		color: var(--color-text-primary, #fff);
		font-variant-numeric: tabular-nums;
	}
	.dismiss {
		margin-top: var(--space-2);
		padding: 10px 28px;
		border-radius: var(--radius-pill);
		background: var(--color-text-primary, #fff);
		color: var(--color-canvas, #0b0b0c);
		font-weight: var(--weight-semibold);
	}
</style>
