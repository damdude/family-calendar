/**
 * Minimal in-process pub/sub keyed by pairing token. Server-only.
 * The phone's step POSTs publish; the kiosk's SSE stream subscribes.
 */

import type { KioskEvent } from '$lib/setup/types';

type Listener = (event: KioskEvent) => void;

const channels = new Map<string, Set<Listener>>();

export function subscribe(token: string, fn: Listener): () => void {
	let set = channels.get(token);
	if (!set) {
		set = new Set();
		channels.set(token, set);
	}
	set.add(fn);
	return () => {
		const s = channels.get(token);
		if (!s) return;
		s.delete(fn);
		if (s.size === 0) channels.delete(token);
	};
}

export function publish(token: string, event: KioskEvent): void {
	channels.get(token)?.forEach((fn) => fn(event));
}
