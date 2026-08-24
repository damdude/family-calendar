/**
 * Real-format detection for photo/avatar uploads, server-only.
 *
 * Uploads were trusted by their client-supplied Content-Type header (only
 * checked to start with "image/"), and that exact header was echoed back
 * verbatim when serving the file from this app's own origin. Since the
 * header is attacker-controlled, `Content-Type: image/svg+xml` with an
 * embedded <script> would be accepted and later served as real SVG — safe
 * through the `<img src>` this app always uses, but one "open image in new
 * tab" away from executing in this origin.
 *
 * Sniffing magic bytes instead means the served Content-Type is always
 * derived from what the file actually is, never from anything the uploader
 * claims — so a script can't ride in as a mislabeled "image". Recognizes
 * every format a real phone/browser upload realistically produces (JPEG,
 * PNG, GIF, WEBP, BMP, HEIC/HEIF, AVIF); anything else — including SVG — is
 * rejected rather than guessed at.
 */

export function sniffImageMime(bytes: Buffer): string | null {
	if (bytes.length < 12) return null;

	if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';

	if (
		bytes[0] === 0x89 &&
		bytes[1] === 0x50 &&
		bytes[2] === 0x4e &&
		bytes[3] === 0x47 &&
		bytes[4] === 0x0d &&
		bytes[5] === 0x0a &&
		bytes[6] === 0x1a &&
		bytes[7] === 0x0a
	)
		return 'image/png';

	const ascii6 = bytes.toString('ascii', 0, 6);
	if (ascii6 === 'GIF87a' || ascii6 === 'GIF89a') return 'image/gif';

	if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP')
		return 'image/webp';

	if (bytes[0] === 0x42 && bytes[1] === 0x4d) return 'image/bmp';

	// ISO base media file format (HEIC/HEIF/AVIF): a size word, then "ftyp",
	// then a 4-char brand identifying the specific format.
	if (bytes.toString('ascii', 4, 8) === 'ftyp') {
		const brand = bytes.toString('ascii', 8, 12);
		if (['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand)) return 'image/heic';
		if (['avif', 'avis'].includes(brand)) return 'image/avif';
	}

	return null;
}
