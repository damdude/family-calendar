<script lang="ts">
	import { family } from '$lib/stores/family.svelte';
	import type { LocalEvent } from '$lib/stores/family.svelte';
	import type { FamilyEvent } from '$lib/types';
	import { startOfWeek } from '$lib/time';
	import ProfilePill from '$lib/components/ProfilePill.svelte';
	import WeekGrid from '$lib/components/WeekGrid.svelte';
	import EventEditor from '$lib/components/EventEditor.svelte';
	import QuickAddQr from '$lib/components/QuickAddQr.svelte';
	import { ChevronLeft, ChevronRight, ChevronDown, Plus } from 'lucide-svelte';

	let weekOffset = $state(0);

	// Local-event editor + QR quick-add.
	let editorOpen = $state(false);
	let editing = $state<LocalEvent | null>(null);
	let qrOpen = $state(false);

	function openNew() {
		editing = null;
		editorOpen = true;
	}
	function onEventClick(e: FamilyEvent) {
		// Only user-created local events are editable on the display.
		if (family.readOnly || !family.isLocalEventId(e.id)) return;
		const localId = family.localIdOf(e.id);
		editing = family.localEvents.find((x) => x.id === localId) ?? null;
		if (editing) editorOpen = true;
	}
	function closeEditor() {
		editorOpen = false;
		editing = null;
	}

	const weekStart = $derived.by(() => {
		const today = new Date();
		// Sunday, viewing the actual current week: a plain Mon-Sun grid would
		// end on today, showing an entire week almost completely in the past.
		// Shift the 7-day window forward instead — Wed of the week just
		// finishing through Tue of next week — so it still closes out the
		// last few days of this week but also previews what's coming next
		// week, which is the more useful thing to see stood in front of the
		// display on a Sunday. Only for the current week (weekOffset 0);
		// navigating to a past/future week always shows a plain Mon-Sun.
		if (weekOffset === 0 && today.getDay() === 0) {
			const wed = new Date(today);
			wed.setHours(0, 0, 0, 0);
			wed.setDate(wed.getDate() - 4);
			return wed;
		}
		const base = startOfWeek(today, family.config.view.weekStartsOn);
		base.setDate(base.getDate() + weekOffset * 7);
		return base;
	});

	const rangeLabel = $derived.by(() => {
		const end = new Date(weekStart);
		end.setDate(end.getDate() + 6);
		const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
		return `${fmt(weekStart)} – ${fmt(end)}`;
	});
</script>

<div class="week-view">
	<div class="cal-header">
		<div class="pills">
			{#each family.profiles as p (p.id)}
				<ProfilePill profile={p} />
			{/each}
		</div>

		<div class="controls">
			<span class="range type-label">{rangeLabel}</span>
			<button class="ctrl pressable type-label" type="button">
				Schedule <ChevronDown size={15} />
			</button>
			<button class="ctrl pressable type-label" type="button">
				Filter <ChevronDown size={15} />
			</button>
			<div class="nav">
				<button
					class="navbtn pressable"
					type="button"
					aria-label="Previous week"
					onclick={() => (weekOffset -= 1)}
				>
					<ChevronLeft size={18} />
				</button>
				<button class="today pressable type-label" type="button" onclick={() => (weekOffset = 0)}>
					Today
				</button>
				<button
					class="navbtn pressable"
					type="button"
					aria-label="Next week"
					onclick={() => (weekOffset += 1)}
				>
					<ChevronRight size={18} />
				</button>
			</div>
		</div>
	</div>

	<div class="grid-wrap">
		<WeekGrid {weekStart} events={family.data.events} days={7} {onEventClick} />
	</div>
</div>

{#if !family.readOnly}
	<div class="fabs">
		<button
			class="fab qr"
			type="button"
			aria-label="Add from phone"
			onclick={() => (qrOpen = true)}
		>
			<svg
				width="22"
				height="22"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<rect x="3" y="3" width="7" height="7" rx="1" /><rect
					x="14"
					y="3"
					width="7"
					height="7"
					rx="1"
				/><rect x="3" y="14" width="7" height="7" rx="1" /><path
					d="M14 14h3v3M20 14v.01M14 20h.01M17 20h.01M20 17v3"
				/>
			</svg>
		</button>
		<button class="fab plus" type="button" aria-label="New event" onclick={openNew}>
			<Plus size={26} strokeWidth={2.4} />
		</button>
	</div>
{/if}

{#if editorOpen}
	<EventEditor existing={editing} onClose={closeEditor} onSaved={closeEditor} />
{/if}
{#if qrOpen}
	<QuickAddQr onClose={() => (qrOpen = false)} />
{/if}

<style>
	.week-view {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
	}
	.fabs {
		position: fixed;
		right: var(--space-5);
		/* Clears the bottom tab bar in portrait mode, where it would otherwise
		   sit on top of the last couple of nav items. */
		bottom: calc(var(--space-5) + var(--bottom-nav-clearance, 0px));
		z-index: 50;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3);
	}
	.fab {
		display: grid;
		place-items: center;
		border-radius: var(--radius-pill);
		box-shadow: var(--shadow-float);
		transition: transform var(--dur-quick) var(--ease-out);
	}
	.fab:active {
		transform: scale(0.94);
	}
	.fab.plus {
		width: 60px;
		height: 60px;
		background: var(--color-text-primary);
		color: var(--color-surface);
	}
	.fab.qr {
		width: 46px;
		height: 46px;
		background: var(--color-surface);
		color: var(--color-text-primary);
	}
	.grid-wrap {
		flex: 1;
		min-height: 0;
	}
	.cal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		flex-wrap: wrap;
		padding: var(--space-2) 0 var(--space-4);
	}
	.pills {
		display: flex;
		gap: var(--space-2);
		flex-wrap: wrap;
	}
	.controls {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.range {
		color: var(--color-text-secondary);
		font-variant-numeric: tabular-nums;
		margin-right: var(--space-1);
	}
	.ctrl {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 7px 12px;
		border-radius: var(--radius-pill);
		background: var(--color-surface);
		color: var(--color-text-primary);
		box-shadow: var(--shadow-card);
	}
	.nav {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		padding: 3px;
		border-radius: var(--radius-pill);
		background: var(--color-surface);
		box-shadow: var(--shadow-card);
	}
	.navbtn {
		display: grid;
		place-items: center;
		width: 34px;
		height: 30px;
		border-radius: var(--radius-pill);
		color: var(--color-text-secondary);
	}
	.today {
		padding: 5px 14px;
		border-radius: var(--radius-pill);
		color: var(--color-text-primary);
	}
</style>
