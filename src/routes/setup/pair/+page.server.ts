import { error } from '@sveltejs/kit';
import { claimPairing } from '$lib/server/pairing';
import type { PageServerLoad } from './$types';

function timezones(): string[] {
	try {
		// Node 18+/modern browsers
		const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] })
			.supportedValuesOf;
		if (fn) return fn('timeZone');
	} catch {
		/* fall through */
	}
	return ['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles'];
}

export const load: PageServerLoad = async ({ url }) => {
	const token = url.searchParams.get('token');
	const session = token ? claimPairing(token) : null;
	if (!session) {
		throw error(410, 'This setup link has expired. Scan a fresh code from the display.');
	}
	return {
		token: session.token,
		draft: session.draft,
		timezones: timezones()
	};
};
