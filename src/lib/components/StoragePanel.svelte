<script lang="ts">
	import {
		HardDrive,
		Server,
		ArrowRightLeft,
		Wifi,
		Folder,
		FolderOpen,
		Lock,
		ChevronRight
	} from 'lucide-svelte';

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
	interface NasServer {
		name: string;
		host: string;
		address?: string;
	}
	interface NasShare {
		name: string;
		comment?: string;
	}
	interface NasEntry {
		name: string;
		isDir: boolean;
	}

	let info = $state<Info | null>(null);
	let nasPath = $state('');
	let checkResult = $state<{ ok: boolean; error?: string; disk: Disk | null } | null>(null);
	let busy = $state(false);
	let msg = $state('');
	let showAdvanced = $state(false);

	// --- Network (SMB) browse flow ---
	let scanning = $state(false);
	let servers = $state<NasServer[]>([]);
	let scanned = $state(false);
	let host = $state('');
	let nasUser = $state('');
	let nasPass = $state('');
	let loadingShares = $state(false);
	let shares = $state<NasShare[]>([]);
	let sharesErr = $state('');
	let selectedShare = $state('');
	let mounting = $state(false);

	// --- Folder browse, inside the chosen share — many NAS boxes only expose a
	// share above the real destination (a per-user home share, a shared
	// "Public" volume), so mounting the share root isn't always what you want. ---
	let browsePath = $state<string[]>([]);
	let folderEntries = $state<NasEntry[]>([]);
	let loadingFolder = $state(false);
	let folderErr = $state('');

	async function loadFolder() {
		loadingFolder = true;
		folderErr = '';
		try {
			const r = await fetch('/api/storage/nas/browse', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					host: host.trim(),
					share: selectedShare,
					path: browsePath.join('/'),
					username: nasUser.trim(),
					password: nasPass
				})
			});
			const res = await r.json().catch(() => ({ ok: false }));
			if (res.ok) folderEntries = res.entries ?? [];
			else folderErr = res.error ?? 'Could not open that folder.';
		} finally {
			loadingFolder = false;
		}
	}

	function pickShare(name: string) {
		selectedShare = name;
		browsePath = [];
		folderErr = '';
		loadFolder();
	}

	function openFolder(name: string) {
		browsePath = [...browsePath, name];
		loadFolder();
	}

	/** Jump to a breadcrumb segment; -1 is the share root. */
	function jumpTo(i: number) {
		browsePath = browsePath.slice(0, i + 1);
		loadFolder();
	}

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

	async function scan() {
		scanning = true;
		try {
			const r = await fetch('/api/storage/nas/discover', { method: 'POST' });
			const res = await r.json().catch(() => ({ servers: [] }));
			servers = res.servers ?? [];
			scanned = true;
		} finally {
			scanning = false;
		}
	}

	async function browseShares() {
		if (!host.trim()) return;
		loadingShares = true;
		sharesErr = '';
		shares = [];
		selectedShare = '';
		try {
			const r = await fetch('/api/storage/nas/shares', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ host: host.trim(), username: nasUser.trim(), password: nasPass })
			});
			const res = await r.json().catch(() => ({ ok: false }));
			if (res.ok) shares = res.shares ?? [];
			else sharesErr = res.error ?? 'Could not list shares.';
		} finally {
			loadingShares = false;
		}
	}

	async function useShare() {
		if (!selectedShare) return;
		mounting = true;
		msg = '';
		try {
			const r = await fetch('/api/storage/nas/mount', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					host: host.trim(),
					share: selectedShare,
					folder: browsePath.join('/') || undefined,
					username: nasUser.trim(),
					password: nasPass
				})
			});
			const res = await r.json().catch(() => ({}));
			if (r.ok && res.ok) {
				msg = res.restartRequired
					? 'Mounted and data copied. The device will use the NAS after its next restart.'
					: 'Mounted and set as storage.';
				nasPass = '';
				await load();
			} else {
				msg = res.error ?? 'Could not mount the share.';
			}
		} finally {
			mounting = false;
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
				<p class="type-label"><Server size={15} /> Store data on a network drive (NAS)</p>

				<!-- Step 1: find servers -->
				<button type="button" class="btn ghost" disabled={scanning} onclick={scan}>
					<Wifi size={16} />
					{scanning ? 'Scanning…' : 'Scan the network'}
				</button>
				{#if scanned && servers.length === 0}
					<p class="type-caption sub">
						No servers found automatically — type your NAS name or IP below.
					</p>
				{/if}
				{#if servers.length}
					<div class="serverlist">
						{#each servers as s (s.host)}
							<button
								type="button"
								class="server"
								class:on={host === s.host}
								onclick={() => {
									host = s.host;
									shares = [];
									selectedShare = '';
								}}
							>
								<Server size={16} />
								<span class="sname">{s.name}</span>
								<span class="type-caption sub">{s.address ?? s.host}</span>
							</button>
						{/each}
					</div>
				{/if}

				<!-- Step 2: server + credentials -->
				<label class="type-caption sub" for="nas-host">Server name or IP</label>
				<input id="nas-host" class="in" type="text" placeholder="my-nas.local" bind:value={host} />
				<div class="row">
					<input
						class="in"
						type="text"
						placeholder="Username"
						bind:value={nasUser}
						autocomplete="off"
					/>
					<input
						class="in"
						type="password"
						placeholder="Password"
						bind:value={nasPass}
						autocomplete="off"
					/>
				</div>
				<button
					type="button"
					class="btn ghost"
					disabled={loadingShares || !host.trim()}
					onclick={browseShares}
				>
					<Lock size={15} />
					{loadingShares ? 'Connecting…' : 'Show shares'}
				</button>
				{#if sharesErr}<p class="type-caption err">✗ {sharesErr}</p>{/if}

				<!-- Step 3: pick a share -->
				{#if shares.length && !selectedShare}
					<div class="serverlist">
						{#each shares as sh (sh.name)}
							<button type="button" class="server" onclick={() => pickShare(sh.name)}>
								<Folder size={16} />
								<span class="sname">{sh.name}</span>
								{#if sh.comment}<span class="type-caption sub">{sh.comment}</span>{/if}
							</button>
						{/each}
					</div>
				{/if}

				<!-- Step 4: browse into the share to find where to actually store data —
				     many NAS boxes expose a share above the real destination. -->
				{#if selectedShare}
					<div class="folderbrowse">
						<div class="crumbs">
							<button type="button" class="crumb" onclick={() => jumpTo(-1)}>{selectedShare}</button
							>
							{#each browsePath as seg, i (i)}
								<ChevronRight size={13} class="sub" />
								<button type="button" class="crumb" onclick={() => jumpTo(i)}>{seg}</button>
							{/each}
						</div>

						{#if loadingFolder}
							<p class="type-caption sub">Loading…</p>
						{:else if folderErr}
							<p class="type-caption err">✗ {folderErr}</p>
						{:else if folderEntries.filter((e) => e.isDir).length === 0}
							<p class="type-caption sub">No subfolders here.</p>
						{:else}
							<div class="serverlist">
								{#each folderEntries.filter((e) => e.isDir) as entry (entry.name)}
									<button type="button" class="server" onclick={() => openFolder(entry.name)}>
										<FolderOpen size={16} />
										<span class="sname">{entry.name}</span>
									</button>
								{/each}
							</div>
						{/if}

						<button
							type="button"
							class="linkish"
							onclick={() => {
								selectedShare = '';
								browsePath = [];
							}}
						>
							Choose a different share
						</button>

						<button type="button" class="btn primary" disabled={mounting} onclick={useShare}>
							<ArrowRightLeft size={16} />
							{mounting
								? 'Mounting…'
								: `Use ${browsePath.length ? 'this folder' : 'this share'} for storage`}
						</button>
					</div>
				{/if}

				<!-- Advanced: point at an already-mounted folder -->
				<button type="button" class="linkish" onclick={() => (showAdvanced = !showAdvanced)}>
					{showAdvanced ? 'Hide' : 'Advanced:'} use an already-mounted folder
				</button>
				{#if showAdvanced}
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
						<ArrowRightLeft size={16} /> Move to this folder
					</button>
				{/if}
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
	.serverlist {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.server {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 12px;
		border-radius: var(--radius-md);
		background: var(--color-surface-elevated);
		text-align: left;
		width: 100%;
	}
	.server.on {
		box-shadow: inset 0 0 0 2px var(--color-profile-blue);
	}
	.sname {
		font-weight: var(--weight-semibold);
		color: var(--color-text-primary);
	}
	.linkish {
		align-self: flex-start;
		color: var(--color-text-secondary);
		font-size: var(--text-sm);
		text-decoration: underline;
		padding: 4px 0;
	}
	.folderbrowse {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-3);
		border-radius: var(--radius-md);
		background: var(--color-surface-elevated);
	}
	.crumbs {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 4px;
	}
	.crumb {
		padding: 3px 8px;
		border-radius: var(--radius-sm);
		font-weight: var(--weight-semibold);
		font-size: var(--text-sm);
		color: var(--color-text-primary);
	}
	.crumb:hover {
		background: var(--color-surface);
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
