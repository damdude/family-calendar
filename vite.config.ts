import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// Node adapter: self-hosted on the Raspberry Pi (a long-lived Node
			// server, required for SQLite/cron/SSE). `build/` runs with `node build`.
			adapter: adapter()
		})
	],

	test: {
		// Server-side logic only — these are pure-function tests, so they need
		// Node rather than a DOM, and the SvelteKit plugin above already
		// supplies the $lib resolution they rely on.
		environment: 'node',
		include: ['src/**/*.test.ts']
	}
});
