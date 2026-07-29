import { subscribeLive } from '$lib/server/live';
import type { RequestHandler } from './$types';

/** Dashboard SSE: emits `data: refresh` when server-side data changes. */
export const GET: RequestHandler = () => {
	const enc = new TextEncoder();
	let heartbeat: ReturnType<typeof setInterval>;
	let unsub: () => void = () => {};

	const stream = new ReadableStream({
		start(controller) {
			const send = (s: string) => {
				try {
					controller.enqueue(enc.encode(s));
				} catch {
					/* closed */
				}
			};
			send('data: hello\n\n');
			unsub = subscribeLive(() => send('data: refresh\n\n'));
			heartbeat = setInterval(() => send(': ping\n\n'), 15000);
		},
		cancel() {
			clearInterval(heartbeat);
			unsub();
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
