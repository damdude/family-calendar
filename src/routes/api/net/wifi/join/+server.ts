import { json, error } from '@sveltejs/kit';
import { joinWifi } from '$lib/server/network';
import type { RequestHandler } from './$types';

/** Join a Wi-Fi network chosen on-screen. Password is never logged. */
export const POST: RequestHandler = async ({ request }) => {
	const { ssid, password } = await request.json().catch(() => ({}));
	if (!ssid || typeof ssid !== 'string') error(400, 'ssid required');
	const res = await joinWifi(ssid, typeof password === 'string' ? password : '');
	return json(res, { status: res.ok ? 200 : 422 });
};
