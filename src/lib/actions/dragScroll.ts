/**
 * Drag-to-scroll for touchscreens — Pointer Events only, following apple-design:
 * 1:1 tracking with setPointerCapture, a small movement threshold before
 * committing (so taps still register), release-velocity momentum with
 * deceleration, and interruptibility (grabbing again stops the glide).
 *
 * Reuses the home-display pointer-gesture pattern. Momentum is skipped under
 * prefers-reduced-motion.
 *
 * Usage: <div use:dragScroll> … scrollable content … </div>
 */

interface Options {
	axis?: 'x' | 'y' | 'both';
	threshold?: number;
}

export function dragScroll(node: HTMLElement, opts: Options = {}) {
	const axis = opts.axis ?? 'y';
	const threshold = opts.threshold ?? 8;

	let pointerId: number | null = null;
	let startX = 0;
	let startY = 0;
	let lastX = 0;
	let lastY = 0;
	let lastT = 0;
	let vx = 0;
	let vy = 0;
	let dragging = false;
	let momentum = 0;

	const reduce = () =>
		typeof window !== 'undefined' &&
		window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

	function onPointerDown(e: PointerEvent) {
		// Ignore secondary buttons; let mouse wheels/precise pointers scroll natively.
		if (e.button !== 0) return;
		cancelAnimationFrame(momentum);
		pointerId = e.pointerId;
		startX = lastX = e.clientX;
		startY = lastY = e.clientY;
		lastT = e.timeStamp;
		vx = vy = 0;
		dragging = false;
	}

	function onPointerMove(e: PointerEvent) {
		if (e.pointerId !== pointerId) return;
		const dx = e.clientX - lastX;
		const dy = e.clientY - lastY;

		if (!dragging) {
			if (Math.hypot(e.clientX - startX, e.clientY - startY) < threshold) return;
			dragging = true;
			node.setPointerCapture(pointerId);
			node.classList.add('dragging');
		}

		if (axis !== 'x') node.scrollTop -= dy;
		if (axis !== 'y') node.scrollLeft -= dx;

		const dt = Math.max(1, e.timeStamp - lastT);
		vx = dx / dt;
		vy = dy / dt;
		lastX = e.clientX;
		lastY = e.clientY;
		lastT = e.timeStamp;
		e.preventDefault();
	}

	function endDrag(e: PointerEvent) {
		if (e.pointerId !== pointerId) return;
		pointerId = null;
		if (!dragging) return;
		node.classList.remove('dragging');

		// Suppress the click that would otherwise fire after a drag.
		const suppress = (ev: Event) => {
			ev.stopPropagation();
			ev.preventDefault();
		};
		node.addEventListener('click', suppress, { capture: true, once: true });
		setTimeout(() => node.removeEventListener('click', suppress, { capture: true } as never), 0);

		if (reduce()) return;
		// Momentum: carry release velocity with friction until it fades.
		let velY = vy * 16; // px per ~frame
		let velX = vx * 16;
		const friction = 0.94;
		const step = () => {
			velY *= friction;
			velX *= friction;
			if (axis !== 'x') node.scrollTop -= velY;
			if (axis !== 'y') node.scrollLeft -= velX;
			if (Math.abs(velY) > 0.2 || Math.abs(velX) > 0.2) momentum = requestAnimationFrame(step);
		};
		momentum = requestAnimationFrame(step);
	}

	node.addEventListener('pointerdown', onPointerDown);
	node.addEventListener('pointermove', onPointerMove);
	node.addEventListener('pointerup', endDrag);
	node.addEventListener('pointercancel', endDrag);

	return {
		destroy() {
			cancelAnimationFrame(momentum);
			node.removeEventListener('pointerdown', onPointerDown);
			node.removeEventListener('pointermove', onPointerMove);
			node.removeEventListener('pointerup', endDrag);
			node.removeEventListener('pointercancel', endDrag);
		}
	};
}
