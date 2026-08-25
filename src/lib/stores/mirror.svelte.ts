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
	/** Controller only: the TV-side path matching whichever tab is active on
	 *  the phone companion page right now (e.g. switching to Lists there
	 *  should switch the display to /lists too) — not a full mirror of the
	 *  phone's route, just which top-level section to show. Null until the
	 *  companion page sets it. */
	activePath = $state<string | null>(null);

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
	 *  once a QR exists.
	 *
	 *  Retries on failure instead of giving up silently: this is only ever
	 *  triggered by a component's mount effect (PhoneMirrorPanel, and
	 *  TvIdleScreen as a redundant safety net below), so a single failed
	 *  fetch — e.g. one that happened to land in the few seconds a deploy's
	 *  `systemctl restart` was cycling the server — used to leave qrSvg empty
	 *  for the rest of that browser session: nothing else ever calls this
	 *  again once the component that first did is unmounted (e.g. the TV
	 *  going idle swaps PhoneMirrorPanel out for TvIdleScreen), so the kiosk
	 *  was stuck showing the idle screen with no QR until someone manually
	 *  reloaded it. Confirmed as the cause of exactly that on-device. */
	async ensureQr() {
		if (this.qrSvg || this.qrLoading) return;
		this.qrLoading = true;
		try {
			// A request that hangs instead of failing outright (the TCP
			// connection accepted but never answered — plausible mid-restart)
			// would otherwise leave qrLoading stuck true forever: the retry
			// below only runs once this fetch actually settles, so a fetch
			// with no timeout can wedge the QR off for the rest of the
			// browser session with no further attempts ever made.
			const ctrl = new AbortController();
			const t = setTimeout(() => ctrl.abort(), 10_000);
			let r: Response;
			try {
				r = await fetch('/api/mirror/start', { method: 'POST', signal: ctrl.signal });
			} finally {
				clearTimeout(t);
			}
			if (!r.ok) throw new Error(`mirror/start ${r.status}`);
			const d = await r.json();
			this.qrSvg = d.qrSvg;
			this.qrUrl = d.url;
			this.becomeDisplay(d.token);
		} catch {
			setTimeout(() => {
				this.qrLoading = false;
				this.ensureQr();
			}, 15_000);
			return;
		}
		this.qrLoading = false;
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
		this.activePath = null;
		if (browser) {
			localStorage.removeItem(DISPLAY_KEY);
			sessionStorage.removeItem(CONTROLLER_KEY);
		}
	}
}

export const mirror = new MirrorControl();
