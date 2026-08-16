import { subscribePath, isControllerConnected } from '$lib/server/mirror';
import type { RequestHandler } from './$types';

/**
 * Display SSE: streams the controller's current path (`data: <path>`) and,
 * on a named `status` event, whether a phone is actively paired right now —
 * the TV's QR ↔ "Phone paired" swap needs to know the moment that changes,
 * not just when the controller happens to navigate.
 */
export const GET: RequestHandler = ({ url }) => {
	const token = url.searchParams.get('token');
	const enc = new TextEncoder();
	let heartbeat: ReturnType<typeof setInterval>;
	let statusPoll: ReturnType<typeof setInterval>;
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

			// Push a status event whenever "is a phone paired" changes, and once
			// up front so a freshly-opened display doesn't have to wait for the
			// first tick to know it's alone.
			let lastConnected = isControllerConnected(token);
			send(`event: status\ndata: ${lastConnected}\n\n`);
			statusPoll = setInterval(() => {
				const connected = isControllerConnected(token);
				if (connected !== lastConnected) {
					lastConnected = connected;
					send(`event: status\ndata: ${connected}\n\n`);
				}
			}, 3000);
		},
		cancel() {
			clearInterval(heartbeat);
			clearInterval(statusPoll);
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
