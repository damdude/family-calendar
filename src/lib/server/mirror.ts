/**
 * Phone-mirror channel (server-only, in-memory).
 *
 * The TV shows a QR; a phone that scans it becomes the *controller*. As the
 * phone navigates the app, it POSTs its current path here and the TV (the
 * *display*) — subscribed over SSE — follows to the same screen. One family =
 * one TV, but we key by pairing token so a stale phone can't drive the display.
 */

type Listener = (path: string) => void;

interface Channel {
	path: string;
	listeners: Set<Listener>;
	updatedAt: number;
	/** Whether a controller has actually pushed a path (vs the default). */
	everPushed: boolean;
}

const channels = new Map<string, Channel>();
const TTL_MS = 60 * 60 * 1000; // 1h idle → drop

function prune() {
	const now = Date.now();
	for (const [token, ch] of channels) {
		if (ch.listeners.size === 0 && now - ch.updatedAt > TTL_MS) channels.delete(token);
	}
}

function channel(token: string): Channel {
	let ch = channels.get(token);
	if (!ch) {
		ch = { path: '/', listeners: new Set(), updatedAt: Date.now(), everPushed: false };
		channels.set(token, ch);
	}
	return ch;
}

/** The controller pushes its current path; broadcast to the display(s). */
export function pushPath(token: string, path: string): void {
	prune();
	const ch = channel(token);
	ch.path = path;
	ch.everPushed = true;
	ch.updatedAt = Date.now();
	for (const fn of ch.listeners) fn(path);
}

/**
 * The display subscribes; returns the last pushed path (null until a controller
 * has actually navigated — so opening the pairing screen doesn't bounce the TV)
 * and an unsubscribe.
 */
export function subscribePath(
	token: string,
	fn: Listener
): { path: string | null; off: () => void } {
	const ch = channel(token);
	ch.listeners.add(fn);
	return {
		path: ch.everPushed ? ch.path : null,
		off: () => ch.listeners.delete(fn)
	};
}
