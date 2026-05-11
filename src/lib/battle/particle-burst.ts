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
        vx: 2 + Math.random() * 4,
        vy: (Math.random() - 0.5) * 3,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.1,
        alpha: 1,
        size: 2 + Math.random() * 3,
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
  p.vy += 0.04 * dt;
  p.rot += p.rotSpeed * dt;
}

export function createParticles(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  maxParticles: number = 400,
): Particle[] {
  // Convert already-rendered canvas pixels into particles so the caller can sample card art
  // once, clear the canvas, and let the burst replace the original image visually.
  const imageData = ctx.getImageData(0, 0, width, height);
  return sampleParticles(imageData, width, height, maxParticles);
}

export function createStatusParticles(width: number, height: number): Particle[] {
  // Status panels have no source image to sample, so synthetic clusters approximate the
  // panel background, HP bar, text, and icons for a matching death breakup.
  const particles: Particle[] = [];
  const padX = Math.round(width * 0.08);
  const padY = Math.round(height * 0.1);
  const textH = Math.round(height * 0.18);
  const barY = Math.round(height * 0.35);
  const barH = Math.max(3, Math.round(height * 0.08));
  const iconY = Math.round(height * 0.55);
  const iconH = Math.round(height * 0.3);

  function scatter(x: number, y: number, w: number, h: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x: x + Math.random() * w,
        y: y + Math.random() * h,
        vx: 2 + Math.random() * 4,
        vy: (Math.random() - 0.5) * 3,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.1,
        alpha: 1,
        size: 2 + Math.random() * 3,
        color,
      });
    }
  }

  // Muted background
  scatter(0, 0, width, height, 'rgb(50, 43, 36)', 120);
  // Lighter patch behind HP
  scatter(padX, barY, width - padX * 2, barH, 'rgb(30, 25, 20)', 10);
  // HP bar fill
  scatter(padX, barY, (width - padX * 2) * 0.6, barH, 'rgb(200, 50, 50)', 15);
  // Title text (left)
  scatter(padX, padY, width * 0.5, textH, 'rgb(210, 195, 170)', 20);
  // HP numbers (right)
  scatter(width * 0.5, padY, width * 0.45, textH, 'rgb(160, 148, 130)', 12);
  // Status icon colors
  scatter(padX, iconY, width * 0.35, iconH, 'rgb(180, 140, 60)', 10);
  scatter(padX + width * 0.15, iconY, width * 0.2, iconH, 'rgb(100, 160, 180)', 8);
  scatter(padX + width * 0.3, iconY, width * 0.2, iconH, 'rgb(60, 180, 80)', 6);

  return particles;
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
