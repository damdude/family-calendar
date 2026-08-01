import { subscribePath } from '$lib/server/mirror';
import type { RequestHandler } from './$types';

/** Display SSE: streams the controller's current path. Emits `data: <path>`. */
export const GET: RequestHandler = ({ url }) => {
	const token = url.searchParams.get('token');
	const enc = new TextEncoder();
	let heartbeat: ReturnType<typeof setInterval>;
	let off: () => void = () => {};

	const stream = new ReadableStream({
		start(controller) {
			const send = (s: string) => {
				try {
					controller.enqueue(enc.encode(s));
				} catch {
					/* closed */
				}
			};
			if (!token) {
				send('event: error\ndata: no-token\n\n');
				return;
			}
			const sub = subscribePath(token, (path) => send(`data: ${path}\n\n`));
			off = sub.off;
			// Catch a late-joining display up, but only once a controller has
			// actually navigated (otherwise the TV would bounce off /pair).
			if (sub.path) send(`data: ${sub.path}\n\n`);
			heartbeat = setInterval(() => send(': ping\n\n'), 15000);
		},
		cancel() {
			clearInterval(heartbeat);
			off();
		}
	});

	return new Response(stream, {
		headers: {
			'content-type': 'text/event-stream',
			'cache-control': 'no-cache',
			connection: 'keep-alive'
		}
	});
};
