import { error } from '@sveltejs/kit';
import { readAvatar } from '$lib/server/media';
import type { RequestHandler } from './$types';

/** Serve a decrypted avatar photo. 404 when the profile has none. */
export const GET: RequestHandler = async ({ params }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id)) throw error(400, 'bad profile id');

	const avatar = await readAvatar(id);
	if (!avatar) throw error(404, 'no avatar');

	return new Response(new Uint8Array(avatar.bytes), {
		headers: {
			'content-type': avatar.mime,
			// Private + short cache; the ?v=<photoUpdatedAt> query busts it on change.
			'cache-control': 'private, max-age=3600'
		}
	});
};
