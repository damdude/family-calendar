<script lang="ts">
	import type { FamilyEvent, ProfileColor } from '$lib/types';
	import { family } from '$lib/stores/family.svelte';
	import { profileColorVar } from '$lib/design/colors';
	import { fractionalHour, timeSlots, weekColumns } from '$lib/time';
	import EventCard from './EventCard.svelte';

	let {
		weekStart,
		events,
		days = 7,
		onEventClick
	}: {
		weekStart: Date;
		events: FamilyEvent[];
		days?: number;
		onEventClick?: (e: FamilyEvent) => void;
	} = $props();

	const startHour = $derived(family.config.view.dayStartHour);
	const endHour = $derived(family.config.view.dayEndHour);
	const span = $derived(endHour - startHour); // total hours shown
	const slots = $derived(timeSlots(startHour, endHour, family.config.view.clock24h));
	const columns = $derived(weekColumns(weekStart, days));

	function dayIndex(d: Date): number {
		const day = new Date(d);
		day.setHours(0, 0, 0, 0);
		return Math.round((day.getTime() - weekStart.getTime()) / 86_400_000);
	}

	const allDayEvents = $derived(events.filter((e) => e.allDay));
	const timedEvents = $derived(events.filter((e) => !e.allDay));

	function tint(color: ProfileColor, pct = 74) {
		return `color-mix(in srgb, ${profileColorVar(color)} ${pct}%, white)`;
	}

	function barBackground(e: FamilyEvent): string {
		const ppl = e.profileIds.map((id) => family.profile(id)).filter((p) => p !== undefined);
		if (ppl.length === 0) return 'var(--color-accent-allday)';
		if (ppl.length >= 2) return 'color-mix(in srgb, var(--color-profile-blue) 74%, white)';
		return tint(ppl[0].color);
	}

	function clamp(h: number): number {
		return Math.min(Math.max(h, startHour), endHour);
	}

	function pct(h: number): number {
		return ((clamp(h) - startHour) / span) * 100;
	}

	interface Placed {
		event: FamilyEvent;
		topPct: number;
		heightPct: number;
		leftPct: number;
		widthPct: number;
	}

	/** Position + lane-split the timed events for one day column. */
	function layoutDay(colIndex: number): Placed[] {
		const dayEvents = timedEvents
			.filter((e) => dayIndex(e.start) === colIndex)
			.sort((a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime());

		const placed: Placed[] = [];
		let cluster: FamilyEvent[] = [];
		let clusterEnd = -Infinity;

		const flush = () => {
			if (!cluster.length) return;
			const laneEnds: number[] = [];
			const lanes = new Map<number, number>();
			for (const e of cluster) {
				const s = e.start.getTime();
				let lane = laneEnds.findIndex((end) => end <= s);
				if (lane === -1) {
					lane = laneEnds.length;
					laneEnds.push(0);
				}
				laneEnds[lane] = e.end.getTime();
				lanes.set(e.id, lane);
			}
			const cols = laneEnds.length;
			for (const e of cluster) {
				const topPct = pct(fractionalHour(e.start));
				const bottomPct = pct(fractionalHour(e.end));
				const lane = lanes.get(e.id)!;
				placed.push({
					event: e,
					topPct,
					heightPct: bottomPct - topPct,
					leftPct: (lane / cols) * 100,
					widthPct: (1 / cols) * 100
				});
			}
			cluster = [];
			clusterEnd = -Infinity;
		};

		for (const e of dayEvents) {
			if (cluster.length && e.start.getTime() >= clusterEnd) flush();
			cluster.push(e);
			clusterEnd = Math.max(clusterEnd, e.end.getTime());
		}
		flush();
		return placed;
	}

	function barSpan(e: FamilyEvent): { start: number; end: number } | null {
		const s = Math.max(0, dayIndex(e.start));
		const en = Math.min(days - 1, dayIndex(e.end));
		if (en < 0 || s > days - 1) return null;
		return { start: s, end: en };
	}
</script>

<div class="grid">
	<!-- Header row -->
	<div class="row header">
		<div class="rail"></div>
		<div class="cols" style:--cols={days}>
			{#each columns as col (col.date.getTime())}
				<div class="dayhead" class:today={col.isToday}>
					<span class="dow type-caption">{col.label}</span>
					<span class="dnum type-heading">{col.dayNum}</span>
				</div>
			{/each}
		</div>
	</div>

	<!-- All-day / multi-day lane -->
	{#if allDayEvents.length}
		<div class="row allday">
			<div class="rail"><span class="type-caption rail-lbl">all-day</span></div>
			<div class="alldaycols">
				{#each allDayEvents as e (e.id)}
					{@const s = barSpan(e)}
					{#if s}
						<div
							class="allday-bar type-caption"
							style:left="{(s.start / days) * 100}%"
							style:width="{((s.end - s.start + 1) / days) * 100}%"
							style:background={barBackground(e)}
						>
							{e.title}
						</div>
					{/if}
				{/each}
			</div>
		</div>
	{/if}

	<!-- Time body (fills remaining height) -->
	<div class="row body">
		<div class="rail">
			{#each slots as s (s.hour)}
				<span
					class="hourlabel type-caption"
					class:minor={!s.major}
					style:top="{((s.hour - startHour) / span) * 100}%"
				>
					{s.label}
				</span>
			{/each}
		</div>
		<div class="cols bodycols" style:--cols={days}>
			{#each columns as col, i (col.date.getTime())}
				<div class="daycol" class:today={col.isToday}>
					{#each slots as s (s.hour)}
						<div
							class="hourline"
							class:minor={!s.major}
							style:top="{((s.hour - startHour) / span) * 100}%"
						></div>
					{/each}
					{#each layoutDay(i) as p (p.event.id)}
						<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
						<div
							class="event-pos"
							class:clickable={!!onEventClick}
							style:top="{p.topPct}%"
							style:height="{p.heightPct}%"
							style:left="calc({p.leftPct}% + 3px)"
							style:width="calc({p.widthPct}% - 6px)"
							role={onEventClick ? 'button' : undefined}
							tabindex={onEventClick ? 0 : undefined}
							onclick={() => onEventClick?.(p.event)}
							onkeydown={(e) => e.key === 'Enter' && onEventClick?.(p.event)}
						>
							<EventCard event={p.event} />
						</div>
					{/each}
				</div>
			{/each}
		</div>
	</div>
</div>

<style>
	.grid {
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%;
		min-height: 0;
	}
	.row {
		display: flex;
		align-items: stretch;
	}
	.body {
		flex: 1;
		min-height: 0;
	}
	.rail {
		width: 56px;
		flex: none;
		position: relative;
	}
	.rail-lbl {
		position: absolute;
		right: 8px;
		top: 50%;
		transform: translateY(-50%);
		color: var(--color-text-tertiary);
	}
	.cols {
		flex: 1;
		display: grid;
		grid-template-columns: repeat(var(--cols, 7), 1fr);
	}

	/* Header */
	.dayhead {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		padding: 4px 0 8px;
	}
	.dow {
		color: var(--color-text-tertiary);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.dnum {
		color: var(--color-text-primary);
		width: 1.9em;
		height: 1.9em;
		display: grid;
		place-items: center;
		border-radius: var(--radius-pill);
	}
	.dayhead.today .dnum {
		background: var(--color-text-primary);
		color: var(--color-surface);
	}
	.dayhead.today .dow {
		color: var(--color-text-primary);
	}

	/* All-day lane */
	.allday {
		border-top: 1px solid var(--color-border-subtle);
	}
	.alldaycols {
		flex: 1;
		position: relative;
		min-height: 34px;
		padding: 5px 0;
	}
	.allday-bar {
		position: absolute;
		top: 5px;
		height: 24px;
		display: flex;
		align-items: center;
		padding: 0 12px;
		margin: 0 3px;
		border-radius: var(--radius-pill);
		color: var(--color-text-primary);
		font-weight: var(--weight-semibold);
		white-space: nowrap;
		overflow: hidden;
		box-shadow: var(--shadow-card);
	}

	/* Body */
	.body {
		border-top: 1px solid var(--color-border-subtle);
	}
	.hourlabel {
		position: absolute;
		right: 8px;
		transform: translateY(-50%);
		color: var(--color-text-tertiary);
		font-variant-numeric: tabular-nums;
	}
	.hourlabel.minor {
		font-size: 0.8em;
		opacity: 0.6;
	}
	.bodycols {
		position: relative;
	}
	.daycol {
		position: relative;
		border-left: 1px solid var(--color-border-hairline);
	}
	.daycol:last-child {
		border-right: 1px solid var(--color-border-hairline);
	}
	.daycol.today {
		background: color-mix(in srgb, var(--color-accent-gold) 8%, transparent);
	}
	.hourline {
		position: absolute;
		left: 0;
		right: 0;
		height: 1px;
		background: var(--color-border-hairline);
	}
	.hourline.minor {
		opacity: 0.5;
	}
	.event-pos {
		position: absolute;
		min-height: 30px;
	}
	.event-pos.clickable {
		cursor: pointer;
	}
</style>
