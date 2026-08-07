import { json } from '@sveltejs/kit';
import { scanWifi } from '$lib/server/network';
import type { RequestHandler } from './$types';

/** Nearby Wi-Fi networks for the on-screen picker (touch mode). */
export const GET: RequestHandler = async () => {
	return json({ networks: await scanWifi() });
};
