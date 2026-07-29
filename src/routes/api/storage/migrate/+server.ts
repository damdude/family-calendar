import { error, json } from '@sveltejs/kit';
import { spawn } from 'node:child_process';
import { z } from 'zod';
import { migrateTo } from '$lib/server/storage';
import type { RequestHandler } from './$types';

const Body = z.object({
	mode: z.enum(['local', 'nas']),
	path: z.string().optional()
});

/** Migrate data local <-> NAS, then restart the service so the new location
 *  takes effect (no-op restart off-device). */
export const POST: RequestHandler = async ({ request }) => {
	const parsed = Body.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, 'invalid request');

	const result = await migrateTo(parsed.data.mode, parsed.data.path);
	if (!result.ok) throw error(400, result.error ?? 'migration failed');

	// Restart so DATA_DIR is re-resolved (systemd on the Pi; ignored elsewhere).
	try {
		const child = spawn('systemctl', ['restart', 'family-calendar'], {
			stdio: 'ignore',
			detached: true
		});
		child.on('error', () => {});
		child.unref();
	} catch {
		/* dev: user restarts manually */
	}
	return json(result);
};
