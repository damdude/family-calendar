/**
 * Client-side mirror role state.
 *
 * - `display`  → this device is the TV. It subscribes to the controller's path
 *   and follows along. Token persists (localStorage) so it keeps following
 *   across reloads.
 * - `controller` → this device is a phone that scanned the QR. It reports its
 *   path to the TV. Token lives in sessionStorage (per phone session).
 * - `idle` → neither; a normal standalone browser.
 *
 * Controller wins if somehow both are set on one device.
 */

import { browser } from '$app/environment';

const DISPLAY_KEY = 'fc.mirror.display';
const CONTROLLER_KEY = 'fc.mirror.controller';

type Role = 'idle' | 'display' | 'controller';

class MirrorControl {
	role = $state<Role>('idle');
	token = $state<string | null>(null);
	/** True once the display has an open event stream. */
	connected = $state(false);
	/** Display only: a phone is actively paired right now (heartbeating), not
	 *  just that our own SSE stream to the server happens to be open. */
	controllerConnected = $state(false);
	/** The pairing QR, fetched once and shared by every display-side consumer
	 *  (the small corner panel, the TV idle screen) — fetching it per-component
	 *  would mint a fresh token each time either one mounts, orphaning any
	 *  phone that scanned the previous one. */
	qrSvg = $state('');
	qrUrl = $state('');
	private qrLoading = false;

	constructor() {
		if (!browser) return;
		const controller = sessionStorage.getItem(CONTROLLER_KEY);
		const display = localStorage.getItem(DISPLAY_KEY);
		if (controller) {
			this.role = 'controller';
			this.token = controller;
		} else if (display) {
			this.role = 'display';
			this.token = display;
		}
	}

	/** This device becomes the TV for the given pairing token. */
	becomeDisplay(token: string) {
		this.role = 'display';
		this.token = token;
		if (browser) localStorage.setItem(DISPLAY_KEY, token);
	}

	/** Fetch the pairing QR once per display session (idempotent — safe to
	 *  call from every place that wants to show it). Re-issuing would orphan
	 *  a phone that already scanned the current one, so this never re-fetches
	 *  once a QR exists. */
	async ensureQr() {
		if (this.qrSvg || this.qrLoading) return;
		this.qrLoading = true;
		try {
			const r = await fetch('/api/mirror/start', { method: 'POST' });
			if (!r.ok) return;
			const d = await r.json();
			this.qrSvg = d.qrSvg;
			this.qrUrl = d.url;
			this.becomeDisplay(d.token);
		} catch {
			/* offline — no QR to show; next call retries */
		} finally {
			this.qrLoading = false;
		}
	}

	/** This device (a scanned phone) becomes the controller. */
	becomeController(token: string) {
		this.role = 'controller';
		this.token = token;
		if (browser) sessionStorage.setItem(CONTROLLER_KEY, token);
	}

	/** Stop mirroring on this device (both roles cleared). */
	stop() {
		this.role = 'idle';
		this.token = null;
		this.connected = false;
		this.controllerConnected = false;
		if (browser) {
			localStorage.removeItem(DISPLAY_KEY);
			sessionStorage.removeItem(CONTROLLER_KEY);
		}
	}
}

export const mirror = new MirrorControl();
