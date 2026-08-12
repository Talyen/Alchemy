// Canvas particle burst helpers for card/status destruction effects.
// Depends only on Canvas APIs, random motion, performance.now, and requestAnimationFrame.
// Used by battle UI death animations; it never reads or mutates battle state.
import { animateParticleLoop } from "./particle-loop";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
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
      const a = data[i + 3]!;
      if (a < 128) continue;

      particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        alpha: 1,
        size: 1 + Math.random() * 3,
        color: `rgb(${r},${g},${b})`,
      });
    }
  }

  return particles;
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle, progress: number): void {
  if (p.alpha <= 0.01) return;
  p.alpha = Math.max(0, 1 - progress * progress * progress);
  ctx.globalAlpha = p.alpha;
  ctx.fillStyle = p.color;
  ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
}

function stepParticle(p: Particle, dt: number): void {
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.vx *= 0.97;
  p.vy *= 0.97;
  p.vy += 0 * dt;
}

export function createParticles(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  maxParticles: number = 240,
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
  return animateParticleLoop({
    ctx,
    particles,
    width,
    height,
    duration,
    step: stepParticle,
    draw: drawParticle,
    onComplete,
  });
}
