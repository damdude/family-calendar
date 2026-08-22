import { error } from '@sveltejs/kit';
import { readPhoto } from '$lib/server/photos';
import type { RequestHandler } from './$types';

/** Serve a decrypted family-album photo. 404 when it doesn't exist. */
export const GET: RequestHandler = async ({ params }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id)) throw error(400, 'bad photo id');

	const photo = await readPhoto(id);
	if (!photo) throw error(404, 'no such photo');

	return new Response(new Uint8Array(photo.bytes), {
		headers: {
			'content-type': photo.mime,
			// Immutable: a photo's bytes never change once uploaded (delete +
			// re-upload gets a new id), unlike an avatar which is edited in place.
			'cache-control': 'private, max-age=31536000, immutable'
		}
	});
};
