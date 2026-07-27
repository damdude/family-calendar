<script lang="ts">
	// Celebration confetti — fires when `active` turns true, for meaningful
	// moments only (a routine fully completed). Physical, momentum-y motion
	// (apple-design §8, §13). Suppressed under reduced motion, where the star +
	// streak update remain as the non-vestibular feedback (§14).
	let { active = false, duration = 2600 }: { active?: boolean; duration?: number } = $props();

	let canvas: HTMLCanvasElement | undefined = $state();

	const COLORS = ['#f9c74f', '#f8bbd0', '#b3e5fc', '#d4c5f9', '#b5d5b0', '#ffe0b2', '#74c69d'];

	interface Piece {
		x: number;
		y: number;
		vx: number;
		vy: number;
		rot: number;
		vr: number;
		size: number;
		color: string;
	}

	$effect(() => {
		if (!active || !canvas) return;
		if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

		const cv = canvas;
		const ctx = cv.getContext('2d')!;
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		const W = cv.clientWidth;
		const H = cv.clientHeight;
		cv.width = W * dpr;
		cv.height = H * dpr;
		ctx.scale(dpr, dpr);

		const pieces: Piece[] = [];
		const n = 140;
		for (let i = 0; i < n; i++) {
			const fromLeft = i % 2 === 0;
			pieces.push({
				x: fromLeft ? W * 0.1 : W * 0.9,
				y: H * 0.35,
				vx: (fromLeft ? 1 : -1) * (2 + Math.random() * 5),
				vy: -(6 + Math.random() * 7),
				rot: Math.random() * Math.PI,
				vr: (Math.random() - 0.5) * 0.4,
				size: 6 + Math.random() * 8,
				color: COLORS[i % COLORS.length]
			});
		}

		let raf = 0;
		const start = performance.now();
		const gravity = 0.28;

		const frame = (t: number) => {
			const elapsed = t - start;
			ctx.clearRect(0, 0, W, H);
			for (const p of pieces) {
				p.vy += gravity;
				p.x += p.vx;
				p.y += p.vy;
				p.rot += p.vr;
				ctx.save();
				ctx.translate(p.x, p.y);
				ctx.rotate(p.rot);
				ctx.globalAlpha = Math.max(0, 1 - elapsed / duration);
				ctx.fillStyle = p.color;
				ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
				ctx.restore();
			}
			if (elapsed < duration) raf = requestAnimationFrame(frame);
			else ctx.clearRect(0, 0, W, H);
		};
		raf = requestAnimationFrame(frame);
		return () => cancelAnimationFrame(raf);
	});
</script>

{#if active}
	<canvas bind:this={canvas} class="confetti" aria-hidden="true"></canvas>
{/if}

<style>
	.confetti {
		position: fixed;
		inset: 0;
		width: 100vw;
		height: 100vh;
		pointer-events: none;
		z-index: 100;
	}
</style>
