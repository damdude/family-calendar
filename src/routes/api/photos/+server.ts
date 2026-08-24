import { error, json } from '@sveltejs/kit';
import { listPhotos, savePhoto } from '$lib/server/photos';
import { publishLive } from '$lib/server/live';
import { sniffImageMime } from '$lib/server/imageSniff';
import type { RequestHandler } from './$types';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export const GET: RequestHandler = async () => {
	return json(await listPhotos());
};

/** Upload a photo to the shared family album (raw image body). Encrypted at rest. */
export const POST: RequestHandler = async ({ request }) => {
	const mime = request.headers.get('content-type') ?? '';
	if (!mime.startsWith('image/')) throw error(415, 'expected an image');

	const bytes = Buffer.from(await request.arrayBuffer());
	if (bytes.length === 0) throw error(400, 'empty upload');
	if (bytes.length > MAX_BYTES) throw error(413, 'image too large (max 10 MB)');

	// Detect the real format from the bytes rather than trusting the
	// client-supplied header — this is what's actually served back on
	// /media/photo/[id], so a spoofed Content-Type (e.g. claiming an SVG
	// with an embedded <script> is an "image") never reaches disk.
	const sniffed = sniffImageMime(bytes);
	if (!sniffed) throw error(415, "That doesn't look like a supported image format.");

	const meta = await savePhoto(sniffed, bytes);
	publishLive();
	return json({ ok: true, photo: meta });
};
