/**
 * Minimal .env editing. Separate from the route that uses it so it can be
 * unit-tested without pulling in SvelteKit's generated route types.
 */

/** Rewrite a single KEY=value line, preserving comments, ordering and every
 *  unrelated key. Appends the key when it isn't already present. */
export function setEnvLine(contents: string, key: string, value: string): string {
	const lines = contents.split('\n');
	const i = lines.findIndex((l) => l.startsWith(`${key}=`));
	if (i === -1) return `${contents.replace(/\n*$/, '')}\n${key}=${value}\n`;
	lines[i] = `${key}=${value}`;
	return lines.join('\n');
}
