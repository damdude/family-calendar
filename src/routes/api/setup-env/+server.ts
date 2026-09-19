import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import type { RequestHandler } from './$types';

const BodySchema = z.object({
	googleClientId: z.string().optional().default(''),
	googleClientSecret: z.string().optional().default('')
});

/**
 * Save environment variables to .env during setup.
 * These are sensitive credentials that should be kept secure and never committed.
 */
export const POST: RequestHandler = async ({ request }) => {
	const parsed = BodySchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, parsed.error.message);

	const { googleClientId, googleClientSecret } = parsed.data;

	try {
		const envPath = join(process.cwd(), '.env');

		// Read existing .env (if it exists) to preserve other vars
		let envContent = '';
		try {
			envContent = readFileSync(envPath, 'utf-8');
		} catch {
			// File doesn't exist yet, that's fine
		}

		// Parse existing env vars
		const envMap = new Map<string, string>();
		envContent.split('\n').forEach((line) => {
			const match = line.match(/^([^=]+)=(.*)/);
			if (match && !line.startsWith('#')) {
				envMap.set(match[1], match[2]);
			}
		});

		// Update with new values (only if provided/non-empty)
		if (googleClientId) {
			envMap.set('GOOGLE_OAUTH_CLIENT_ID', googleClientId);
		}
		if (googleClientSecret) {
			envMap.set('GOOGLE_OAUTH_CLIENT_SECRET', googleClientSecret);
		}

		// Write back
		const newEnv = Array.from(envMap.entries())
			.map(([key, val]) => `${key}=${val}`)
			.join('\n');

		writeFileSync(envPath, newEnv, 'utf-8');

		return json({ ok: true, message: 'Environment variables saved' });
	} catch (err) {
		console.error('Failed to save environment:', err);
		throw error(500, 'Failed to save environment variables');
	}
};
