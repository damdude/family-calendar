import { subscribe } from '$lib/server/bus';
import { getSession } from '$lib/server/pairing';
import type { KioskEvent } from '$lib/setup/types';
import type { RequestHandler } from './$types';

/**
 * Kiosk SSE stream. The kiosk (holding the pairing token it just generated)
 * subscribes here and receives live draft snapshots as the phone submits, plus
 * a `complete` event when setup finishes.
 */
export const GET: RequestHandler = ({ url }) => {
	const token = url.searchParams.get('token');
	if (!getSession(token)) {
		return new Response('invalid or expired pairing token', { status: 403 });
	}

	const enc = new TextEncoder();
	let heartbeat: ReturnType<typeof setInterval>;
	let unsubscribe: () => void = () => {};

	const stream = new ReadableStream({
		start(controller) {
			const send = (event: KioskEvent) => {
				try {
					controller.enqueue(enc.encode(`data: ${JSON.stringify(event)}\n\n`));
				} catch {
					/* stream closed */
				}
			};
			send({ type: 'hello' });
			unsubscribe = subscribe(token!, send);
			heartbeat = setInterval(() => {
				try {
					controller.enqueue(enc.encode(`: ping\n\n`));
				} catch {
					/* stream closed */
				}
			}, 15000);
		},
		cancel() {
			clearInterval(heartbeat);
			unsubscribe();
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
