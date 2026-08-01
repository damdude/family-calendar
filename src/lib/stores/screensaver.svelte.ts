/** Manual screensaver control (e.g. "Sleep now" from the Sleep tab). */
class ScreensaverControl {
	/** When true, the screensaver shows regardless of idle/sleep-window. */
	forceSleep = $state(false);
}

export const screensaver = new ScreensaverControl();
