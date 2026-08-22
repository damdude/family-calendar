import { error, json } from '@sveltejs/kit';
import { removePhoto } from '$lib/server/photos';
import { publishLive } from '$lib/server/live';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ params }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id)) throw error(400, 'bad photo id');

	const ok = await removePhoto(id);
	if (!ok) throw error(404, 'no such photo');
	publishLive();
	return json({ ok: true });
};
