// Canvas particle burst helpers for card/status destruction effects.
// Depends only on Canvas APIs, random motion, performance.now, and requestAnimationFrame.
// Used by battle UI death animations; it never reads or mutates battle state.
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  rotSpeed: number;
  alpha: number;
  size: number;
  color: string;
}

function sampleParticles(
  imageData: ImageData,
  canvasWidth: number,
  canvasHeight: number,
  maxParticles: number,
): Particle[] {
  // Sampling opaque pixels by stride preserves source image colors while capping particle
  // count; full-resolution particles would be too expensive for responsive card art.
  const data = imageData.data;
  const particles: Particle[] = [];
  const area = canvasWidth * canvasHeight;
  const stride = Math.max(1, Math.round(Math.sqrt(area / maxParticles)));

  for (let y = 0; y < canvasHeight; y += stride) {
    for (let x = 0; x < canvasWidth; x += stride) {
      const i = (y * canvasWidth + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a < 128) continue;

      particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.1,
        alpha: 1,
        size: 1 + Math.random() * 3,
        color: `rgb(${r},${g},${b})`,
      });
    }
  }

  return particles;
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle): void {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  ctx.globalAlpha = p.alpha;
  ctx.fillStyle = p.color;
  ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
  ctx.restore();
}

function stepParticle(p: Particle, dt: number): void {
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.vx *= 0.97;
  p.vy *= 0.97;
  p.vy += 0 * dt;
  p.rot += p.rotSpeed * dt;
}

export function createParticles(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  maxParticles: number = 1600,
): Particle[] {
  // Convert already-rendered canvas pixels into particles so the caller can sample card art
  // once, clear the canvas, and let the burst replace the original image visually.
  const imageData = ctx.getImageData(0, 0, width, height);
  return sampleParticles(imageData, width, height, maxParticles);
}

export function animateParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  width: number,
  height: number,
  duration: number,
  onComplete: () => void,
): () => void {
  // The animation owns its RAF lifecycle and returns cancellation for React unmounts;
  // otherwise delayed death effects could keep drawing into detached canvases.
  let running = true;
  const startTime = performance.now();
  let lastTime = startTime;

  function frame(now: number): void {
    if (!running) return;

    const elapsed = now - startTime;
    const dt = Math.min((now - lastTime) / 16.67, 3);
    lastTime = now;
    const progress = Math.min(elapsed / duration, 1);

    ctx.clearRect(0, 0, width, height);

    for (const p of particles) {
      if (p.alpha <= 0.01) continue;
      stepParticle(p, dt);
      p.alpha = Math.max(0, 1 - progress * progress * progress);
      drawParticle(ctx, p);
    }

    if (progress < 1) {
      requestAnimationFrame(frame);
    } else {
      onComplete();
    }
  }

  requestAnimationFrame(frame);

  return () => {
    running = false;
  };
}
