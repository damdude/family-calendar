/**
 * Global "something changed, reload" channel (server-only). The dashboard
 * subscribes over SSE; server-side mutations from a phone (quick-add) publish a
 * refresh so the display updates live without a manual reload.
 */

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeLive(fn: Listener): () => void {
	listeners.add(fn);
	return () => listeners.delete(fn);
}

export function publishLive(): void {
	for (const fn of listeners) fn();
}
