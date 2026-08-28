export interface ParticleLoopCallbacks<T> {
  step: (particle: T, dt: number) => void;

  draw: (ctx: CanvasRenderingContext2D, particle: T, progress: number) => void;
}

export function animateParticleLoop<T>({
  ctx,
  particles,
  width,
  height,
  duration,
  step,
  draw,
  onComplete,
}: {
  ctx: CanvasRenderingContext2D;
  particles: T[];
  width: number;
  height: number;
  duration: number;
} & ParticleLoopCallbacks<T> & { onComplete: () => void }): () => void {
  let running = true;
  let rafId: number | null = null;
  const startTime = performance.now();
  let lastTime = startTime;

  function frame(now: number): void {
    rafId = null;
    if (!running) return;

    const elapsed = now - startTime;
    const dt = Math.min((now - lastTime) / 16.67, 3);
    lastTime = now;
    const progress = Math.min(elapsed / duration, 1);

    ctx.clearRect(0, 0, width, height);

    for (const p of particles) {
      step(p, dt);
      draw(ctx, p, progress);
    }

    if (progress < 1) {
      rafId = requestAnimationFrame(frame);
    } else {
      onComplete();
    }
  }

  rafId = requestAnimationFrame(frame);

  return () => {
    running = false;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };
}
