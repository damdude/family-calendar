import { error, json } from '@sveltejs/kit';
import { saveAvatar } from '$lib/server/media';
import { sniffImageMime } from '$lib/server/imageSniff';
import type { RequestHandler } from './$types';

const MAX_BYTES = 6 * 1024 * 1024; // 6 MB

/** Upload an avatar photo (raw image body). Stored encrypted at rest. */
export const POST: RequestHandler = async ({ request, params }) => {
	const id = Number(params.id);
	if (!Number.isInteger(id)) throw error(400, 'bad profile id');

	const mime = request.headers.get('content-type') ?? '';
	if (!mime.startsWith('image/')) throw error(415, 'expected an image');

	const bytes = Buffer.from(await request.arrayBuffer());
	if (bytes.length === 0) throw error(400, 'empty upload');
	if (bytes.length > MAX_BYTES) throw error(413, 'image too large (max 6 MB)');

	// Detect the real format from the bytes rather than trusting the
	// client-supplied header — this is what's actually served back on
	// /media/avatar/[id], so a spoofed Content-Type (e.g. claiming an SVG
	// with an embedded <script> is an "image") never reaches disk.
	const sniffed = sniffImageMime(bytes);
	if (!sniffed) throw error(415, "That doesn't look like a supported image format.");

	await saveAvatar(id, sniffed, bytes);
	return json({ ok: true, photoUpdatedAt: Date.now() });
};
