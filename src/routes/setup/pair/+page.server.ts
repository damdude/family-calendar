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
		// Deliberately not a thrown error. A bare 410 reads as a dead end —
		// which is how it was reported — when the way forward is simply to
		// scan the code currently on the display. Sessions now survive a
		// restart, so reaching this at all should be rare.
		return { expired: true as const, token: null, draft: null, timezones: [] };
	}
	return {
		expired: false as const,
		token: session.token,
		draft: session.draft,
		timezones: timezones()
	};
};
