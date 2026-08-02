import { json, error } from '@sveltejs/kit';
import { mountShare } from '$lib/server/nas';
import { migrateTo } from '$lib/server/storage';
import type { RequestHandler } from './$types';

/**
 * Mount a share, then move the family's data onto it. The mount persists in
 * fstab (survives reboots); the data-dir switch takes effect on next restart.
 */
export const POST: RequestHandler = async ({ request }) => {
	const { host, share, username, password } = await request.json().catch(() => ({}));
	if (!host || !share || !username) error(400, 'host, share and username are required');

	const mounted = await mountShare({ host, share, username, password: password ?? '' });
	if (!mounted.ok || !mounted.mountPath) {
		return json({ ok: false, error: mounted.error ?? 'mount failed' }, { status: 422 });
	}

	// Point the data dir at a subfolder of the share so we don't clutter its root.
	const dataTarget = `${mounted.mountPath}/family-calendar`;
	const migrated = await migrateTo('nas', dataTarget);
	return json({
		ok: migrated.ok,
		error: migrated.error,
		mountPath: mounted.mountPath,
		dataDir: dataTarget,
		restartRequired: migrated.restartRequired
	});
};
