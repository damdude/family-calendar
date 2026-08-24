/**
 * Network storage (SMB/CIFS) discovery, browsing, and mounting. Server-only.
 *
 * Shells out to standard Linux tools available on the Pi image:
 *   - avahi-browse  → discover SMB servers advertised on the LAN
 *   - smbclient     → list a server's shares (with the family's credentials)
 *   - a privileged helper (scripts/nas-mount.sh, installed as /usr/local/bin/
 *     fc-nas-mount and allowed via sudoers) → mount the share + persist it in
 *     /etc/fstab so it survives reboots.
 *
 * Everything degrades gracefully when the tools aren't present (e.g. a macOS
 * dev box): discovery returns an empty list and mounting reports it's only
 * available on the appliance.
 *
 * Credentials the user enters are stored encrypted at rest (crypto.ts). The
 * plaintext only ever reaches the mount helper (over stdin), never the log or a
 * process argument.
 */

import { spawn } from 'node:child_process';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR } from './paths';
import { encryptString, decryptString } from './crypto';

export interface NasServer {
	name: string;
	host: string;
	address?: string;
}

export interface NasShare {
	name: string;
	comment?: string;
}

export interface NasConfig {
	host: string;
	share: string;
	/** `/`-joined subfolder inside the share, if one was chosen while browsing. */
	folder?: string;
	username: string;
	mountPath: string;
}

const MOUNT_ROOT = '/mnt/family-calendar';
const NAS_FILE = path.join(DATA_DIR, 'nas.json');

/** Run a command, capture stdout. Never throws — returns null on any failure. */
function run(
	cmd: string,
	args: string[],
	stdin?: string,
	timeoutMs = 15000
): Promise<string | null> {
	return new Promise((resolve) => {
		let child;
		try {
			child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });
		} catch {
			return resolve(null);
		}
		let out = '';
		let done = false;
		const finish = (v: string | null) => {
			if (!done) {
				done = true;
				resolve(v);
			}
		};
		const timer = setTimeout(() => {
			child.kill('SIGKILL');
			finish(null);
		}, timeoutMs);
		child.stdout.on('data', (d) => (out += d.toString()));
		child.on('error', () => {
			clearTimeout(timer);
			finish(null);
		});
		child.on('close', (code) => {
			clearTimeout(timer);
			finish(code === 0 ? out : null);
		});
		if (stdin !== undefined) {
			child.stdin.write(stdin);
			child.stdin.end();
		}
	});
}

/** Discover SMB servers advertised via mDNS (avahi). Empty if unavailable. */
export async function discoverServers(): Promise<NasServer[]> {
	const out = await run('avahi-browse', ['-trp', '_smb._tcp'], undefined, 8000);
	if (!out) return [];
	const servers = new Map<string, NasServer>();
	for (const line of out.split('\n')) {
		// Resolved records begin with '=' and are ';'-separated.
		if (!line.startsWith('=')) continue;
		const f = line.split(';');
		const name = f[3]?.replace(/\\(\d{3})/g, (_, n) => String.fromCharCode(Number(n))) || f[6];
		const host = f[6] || f[7];
		const address = f[7];
		if (host) servers.set(host, { name: name || host, host, address });
	}
	return [...servers.values()];
}

/** List the shares on a server. Guest if no username. */
export async function listShares(
	host: string,
	username?: string,
	password?: string
): Promise<{ ok: boolean; shares: NasShare[]; error?: string }> {
	const auth = username ? ['-U', `${username}%${password ?? ''}`] : ['-N'];
	const out = await run('smbclient', ['-L', `//${host}`, '-g', ...auth], undefined, 12000);
	if (out === null) {
		return {
			ok: false,
			shares: [],
			error: 'Could not reach the server or credentials were rejected.'
		};
	}
	const shares: NasShare[] = [];
	for (const line of out.split('\n')) {
		// -g grouped output: "Disk|ShareName|Comment"
		const [type, name, comment] = line.split('|');
		if (type === 'Disk' && name && !name.endsWith('$')) {
			shares.push({ name, comment: comment?.trim() || undefined });
		}
	}
	return { ok: true, shares };
}

export interface NasEntry {
	name: string;
	isDir: boolean;
}

/**
 * List the contents of a folder inside a share (directories and files),
 * so the family can navigate down to wherever they actually want data
 * stored — many NAS boxes only expose a share at a level above the real
 * destination (a per-user home share, a shared "Public" volume, etc.).
 * `subpath` is a `/`-joined path relative to the share root ('' for the root).
 */
export async function listFolder(
	host: string,
	share: string,
	subpath: string,
	username?: string,
	password?: string
): Promise<{ ok: boolean; entries: NasEntry[]; error?: string }> {
	// `-c` commands are joined with `;` by smbclient's own parser and it
	// additionally treats a leading `!` as "run this as a local shell command"
	// — both are real command-injection primitives, not just cosmetic. Quoting
	// `subpath` for `cd` only protects against spaces splitting into extra
	// tokens, it does NOT stop `;`/`!` from being reinterpreted, so those (and
	// backticks/`$`/control characters, in case a malicious NAS server names a
	// folder with one) are rejected outright rather than merely stripped.
	if (/[;!`$\r\n]/.test(subpath)) {
		return { ok: false, entries: [], error: 'That folder name contains unsupported characters.' };
	}
	const auth = username ? ['-U', `${username}%${password ?? ''}`] : ['-N'];
	// smbclient's own `cd` understands a full relative path in one go; quote it
	// so spaces in folder names don't split into extra command tokens.
	const cmd = subpath ? `cd "${subpath.replace(/"/g, '')}"; ls` : 'ls';
	const out = await run('smbclient', [`//${host}/${share}`, '-c', cmd, ...auth], undefined, 12000);
	if (out === null) {
		return { ok: false, entries: [], error: 'Could not open that folder.' };
	}
	const entries: NasEntry[] = [];
	for (const line of out.split('\n')) {
		// Fixed-ish-width `ls` output: "  <name>  <attrs>  <size>  <date...>".
		// Name may contain spaces, so anchor on the LAST run of 2+ spaces before
		// the attribute/size/date columns rather than splitting on whitespace.
		const m = line.match(/^\s*(.+?)\s{2,}([A-Za-z]*)\s+(-?\d+)\s+/);
		if (!m) continue;
		const name = m[1].trim();
		if (!name || name === '.' || name === '..') continue;
		entries.push({ name, isDir: m[2].includes('D') });
	}
	entries.sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name));
	return { ok: true, entries };
}

export async function loadNasConfig(): Promise<NasConfig | null> {
	try {
		const j = JSON.parse(await fsp.readFile(NAS_FILE, 'utf8'));
		return {
			host: j.host,
			share: j.share,
			folder: j.folder,
			username: j.username,
			mountPath: j.mountPath
		};
	} catch {
		return null;
	}
}

async function saveNasConfig(cfg: NasConfig, password: string): Promise<void> {
	const enc = encryptString(password).toString('base64');
	await fsp.mkdir(DATA_DIR, { recursive: true });
	await fsp.writeFile(NAS_FILE, JSON.stringify({ ...cfg, password: enc }, null, 2), 'utf8');
}

/** The stored (decrypted) password, if any — used to remount at boot. */
export async function nasPassword(): Promise<string | null> {
	try {
		const j = JSON.parse(await fsp.readFile(NAS_FILE, 'utf8'));
		return j.password ? decryptString(Buffer.from(j.password, 'base64')) : null;
	} catch {
		return null;
	}
}

/**
 * Mount a share (optionally a subfolder inside it, chosen by browsing) and
 * persist it (fstab, via the privileged helper). Returns the local mount
 * path on success. The data migration is done separately by the storage
 * layer once the mount exists.
 */
export async function mountShare(opts: {
	host: string;
	share: string;
	/** `/`-joined path relative to the share root, chosen via `listFolder`. */
	folder?: string;
	username: string;
	password: string;
}): Promise<{ ok: boolean; mountPath?: string; error?: string }> {
	// The privileged helper builds the UNC path as //host/<share arg> verbatim,
	// so folding the chosen subfolder into that one argument is enough — no
	// helper-script changes needed to mount below the share root.
	const sharePath = opts.folder ? `${opts.share}/${opts.folder}` : opts.share;
	const safeShare = sharePath.replace(/[^a-zA-Z0-9._-]/g, '_');
	const mountPath = path.join(
		MOUNT_ROOT,
		`${opts.host.replace(/[^a-zA-Z0-9._-]/g, '_')}-${safeShare}`
	);

	// The helper receives the password on stdin (arg 5 = "-" means read stdin).
	const res = await run(
		'sudo',
		['/usr/local/bin/fc-nas-mount', opts.host, sharePath, mountPath, opts.username],
		opts.password + '\n',
		20000
	);
	if (res === null) {
		return {
			ok: false,
			error:
				'Mount failed. On the Family Calendar appliance this uses cifs-utils; on a dev machine it is unavailable.'
		};
	}
	await saveNasConfig(
		{ host: opts.host, share: opts.share, folder: opts.folder, username: opts.username, mountPath },
		opts.password
	);
	return { ok: true, mountPath };
}
