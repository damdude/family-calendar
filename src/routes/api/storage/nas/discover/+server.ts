import { json } from '@sveltejs/kit';
import { discoverServers } from '$lib/server/nas';
import type { RequestHandler } from './$types';

/** Scan the LAN for SMB servers (mDNS). Empty list if none / not supported. */
export const POST: RequestHandler = async () => {
	return json({ servers: await discoverServers() });
};
