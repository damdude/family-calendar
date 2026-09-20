import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { getSession } from '$lib/server/pairing';
import { setEnvLine } from '$lib/server/envFile';
import type { RequestHandler } from './$types';

const BodySchema = z.object({
	token: z.string(),
	googleClientId: z.string().trim().default(''),
	googleClientSecret: z.string().trim().default('')
});

const ENV_PATH = path.resolve('.env');

/**
 * Save the device-level Google OAuth client credentials from the setup wizard.
 *
 * These are written to .env so they survive a restart, AND applied to
 * process.env immediately — isGoogleConfigured() reads process.env at call
 * time, so without the second step the family would have to restart the
 * service before any profile could connect an account.
 */
export const POST: RequestHandler = async ({ request }) => {
	const parsed = BodySchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, 'invalid credentials payload');

	const { token, googleClientId, googleClientSecret } = parsed.data;
	// Same gate as the password step: only a live setup session may write
	// credentials to .env, so nothing else on the LAN can overwrite them.
	if (!getSession(token)) throw error(403, 'This setup session has expired.');
	if (!googleClientId && !googleClientSecret) return json({ ok: true, saved: false });
	if (!googleClientId || !googleClientSecret) {
		throw error(400, 'Both the client ID and the client secret are required.');
	}

	try {
		let contents = await fsp.readFile(ENV_PATH, 'utf8').catch(() => '');
		contents = setEnvLine(contents, 'GOOGLE_OAUTH_CLIENT_ID', googleClientId);
		contents = setEnvLine(contents, 'GOOGLE_OAUTH_CLIENT_SECRET', googleClientSecret);
		await fsp.writeFile(ENV_PATH, contents, { mode: 0o600 });

		process.env.GOOGLE_OAUTH_CLIENT_ID = googleClientId;
		process.env.GOOGLE_OAUTH_CLIENT_SECRET = googleClientSecret;

		return json({ ok: true, saved: true });
	} catch (err) {
		console.error('Failed to save Google credentials:', err);
		throw error(500, 'Could not save the credentials to this device.');
	}
};
