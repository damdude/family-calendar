import { json } from '@sveltejs/kit';
import { storageInfo } from '$lib/server/storage';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	return json(await storageInfo());
};
