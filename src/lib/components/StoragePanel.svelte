<script lang="ts">
	import { HardDrive, Server, ArrowRightLeft } from 'lucide-svelte';

	interface Disk {
		total: number;
		free: number;
		used: number;
	}
	interface Info {
		mode: 'local' | 'nas';
		dataDir: string;
		localPath: string;
		disk: Disk | null;
	}

	let info = $state<Info | null>(null);
	let nasPath = $state('');
	let checkResult = $state<{ ok: boolean; error?: string; disk: Disk | null } | null>(null);
	let busy = $state(false);
	let msg = $state('');

	async function load() {
		const r = await fetch('/api/storage');
		if (r.ok) info = await r.json();
	}
	$effect(() => {
		load();
	});

	function gb(bytes: number): string {
		return (bytes / 1e9).toFixed(1) + ' GB';
	}
	const usedPct = $derived(info?.disk ? (info.disk.used / info.disk.total) * 100 : 0);

	async function checkNas() {
		if (!nasPath.trim()) return;
		busy = true;
		checkResult = null;
		try {
			const r = await fetch('/api/storage/check', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ path: nasPath.trim() })
			});
			checkResult = await r.json();
		} finally {
			busy = false;
		}
	}

	async function migrate(mode: 'local' | 'nas') {
		busy = true;
		msg = '';
		try {
			const r = await fetch('/api/storage/migrate', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ mode, path: mode === 'nas' ? nasPath.trim() : undefined })
			});
			const res = await r.json().catch(() => ({}));
			if (r.ok) {
				msg = res.restartRequired
					? 'Data copied. The device is restarting to use the new location…'
					: 'Storage updated.';
				await load();
			} else {
				msg = res.message ?? 'Migration failed.';
			}
		} finally {
			busy = false;
		}
	}
</script>

<div class="storage">
	{#if !info}
		<p class="type-body sub">Checking storage…</p>
	{:else}
		<div class="current">
			<span class="mode">
				{#if info.mode === 'nas'}<Server size={18} />{:else}<HardDrive size={18} />{/if}
				{info.mode === 'nas' ? 'NAS' : 'Local (on this device)'}
			</span>
			<code class="path">{info.dataDir}</code>
		</div>

		{#if info.disk}
			<div class="disk">
				<div class="bar"><span class="fill" style:width="{usedPct}%"></span></div>
				<span class="type-caption sub"
					>{gb(info.disk.used)} used · {gb(info.disk.free)} free of {gb(info.disk.total)}</span
				>
			</div>
		{/if}

		{#if info.mode === 'local'}
			<div class="nasform">
				<p class="type-label"><Server size={15} /> Move data to a NAS folder</p>
				<p class="type-caption sub">
					Mount your NAS share on the device first (e.g. via <code>/etc/fstab</code>), then give the
					folder path.
				</p>
				<div class="row">
					<input
						class="in"
						type="text"
						placeholder="/mnt/nas/family-calendar"
						bind:value={nasPath}
					/>
					<button
						type="button"
						class="btn ghost"
						disabled={busy || !nasPath.trim()}
						onclick={checkNas}>Check</button
					>
				</div>
				{#if checkResult}
					{#if checkResult.ok}
						<p class="type-caption ok">
							✓ Writable{checkResult.disk ? ` · ${gb(checkResult.disk.free)} free` : ''}
						</p>
					{:else}
						<p class="type-caption err">✗ {checkResult.error}</p>
					{/if}
				{/if}
				<button
					type="button"
					class="btn primary"
					disabled={busy || !checkResult?.ok}
					onclick={() => migrate('nas')}
				>
					<ArrowRightLeft size={16} /> Move to NAS
				</button>
			</div>
		{:else}
			<button type="button" class="btn ghost" disabled={busy} onclick={() => migrate('local')}>
				<ArrowRightLeft size={16} /> Move back to local storage
			</button>
		{/if}

		{#if msg}<p class="type-caption msg">{msg}</p>{/if}
	{/if}
</div>

<style>
	.storage {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.sub {
		color: var(--color-text-secondary);
	}
	.current {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.mode {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-weight: var(--weight-semibold);
	}
	.path,
	code {
		font-family: ui-monospace, monospace;
		font-size: 0.82em;
		color: var(--color-text-secondary);
		word-break: break-all;
	}
	.disk {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.bar {
		height: 12px;
		border-radius: var(--radius-pill);
		background: var(--color-surface-elevated);
		overflow: hidden;
		box-shadow: inset 0 0 0 1px var(--color-border-subtle);
	}
	.fill {
		display: block;
		height: 100%;
		background: var(--color-profile-blue);
		border-radius: var(--radius-pill);
	}
	.nasform {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding-top: var(--space-2);
		border-top: 1px solid var(--color-border-hairline);
	}
	.row {
		display: flex;
		gap: var(--space-2);
	}
	.in {
		flex: 1;
		padding: 9px 12px;
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-border-subtle);
		background: var(--color-surface);
		color: var(--color-text-primary);
	}
	.btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 9px 16px;
		border-radius: var(--radius-pill);
		font-weight: var(--weight-semibold);
		font-size: var(--text-sm);
		align-self: flex-start;
	}
	.btn.primary {
		background: var(--color-text-primary);
		color: var(--color-surface);
	}
	.btn.ghost {
		background: var(--color-surface-elevated);
		color: var(--color-text-primary);
	}
	.btn:disabled {
		opacity: 0.45;
	}
	.ok {
		color: var(--color-accent-success);
	}
	.err {
		color: var(--color-accent-warning);
	}
	.msg {
		color: var(--color-text-secondary);
	}
</style>
