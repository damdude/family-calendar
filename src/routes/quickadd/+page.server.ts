import { error } from '@sveltejs/kit';
import { getSession } from '$lib/server/pairing';
import { loadConfig } from '$lib/server/config';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const token = url.searchParams.get('token');
	if (!token || !getSession(token)) {
		throw error(
			410,
			'This add link has expired. Tap the phone button on the display for a fresh one.'
		);
	}
	const config = await loadConfig();
	return {
		token,
		profiles: config.profiles.map((p) => ({
			id: p.id,
			name: p.name,
			color: p.color,
			avatarEmoji: p.avatarEmoji
		}))
	};
};
