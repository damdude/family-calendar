/**
 * Phone-mirror channel (server-only, in-memory).
 *
 * The TV shows a QR; a phone that scans it becomes the *controller*. As the
 * phone navigates the app, it POSTs its current path here and the TV (the
 * *display*) — subscribed over SSE — follows to the same screen. One family =
 * one TV, but we key by token so a stale phone can't drive the display.
 *
 * Mirror tokens are owned here rather than borrowed from the setup-pairing
 * store: on a TV the QR is on screen permanently, so a 10-minute pairing TTL
 * would silently stop anyone scanning it later in the day. A channel lives as
 * long as the display holds its SSE subscription, plus an idle grace period.
 */

import crypto from 'node:crypto';

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
/** A controller heartbeats every 5s (see /api/mirror/nav); missing two in a
 *  row means the phone's tab was closed or lost its connection. */
const CONTROLLER_TIMEOUT_MS = 15 * 1000;

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

/** Issue a token for a fresh mirror channel (the QR the TV displays). */
export function createMirrorToken(): string {
	prune();
	const token = crypto.randomBytes(16).toString('base64url');
	channel(token); // register so nav can validate it
	return token;
}

/** Is this a live mirror channel? Guards the controller's nav endpoint. */
export function isMirrorToken(token: string): boolean {
	return channels.has(token);
}

/** Is a phone actively paired right now (heartbeated recently), vs never
 *  connected or gone stale? Drives the QR ↔ "Phone paired" swap on the TV. */
export function isControllerConnected(token: string): boolean {
	const ch = channels.get(token);
	return !!ch && ch.everPushed && Date.now() - ch.updatedAt < CONTROLLER_TIMEOUT_MS;
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
