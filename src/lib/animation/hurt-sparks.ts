// Short radial red spark burst for player hurt feedback on battle portraits.
// Depends only on Canvas APIs and requestAnimationFrame; no battle state.
import { animateParticleLoop } from "./particle-loop";

interface HurtSpark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  size: number;
  color: string;
}

const DEFAULT_HURT_SPARK_COLORS = [
  "rgb(220, 38, 38)",
  "rgb(239, 68, 68)",
  "rgb(248, 113, 113)",
  "rgb(251, 146, 60)",
] as const;

const EDGE_INSET = 2;
const OUTWARD_ANGLE_JITTER = 0.5;

export interface HurtSparkBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Picks a random point on the portrait perimeter and the outward-facing normal at that point.
function samplePerimeterSpawn(bounds: HurtSparkBounds): { x: number; y: number; nx: number; ny: number } {
  const { x: originX, y: originY, width, height } = bounds;
  const perimeter = 2 * (width + height);
  let t = Math.random() * perimeter;

  if (t < width) {
    return { x: originX + t, y: originY + EDGE_INSET, nx: 0, ny: -1 };
  }
  t -= width;
  if (t < height) {
    return { x: originX + width - EDGE_INSET, y: originY + t, nx: 1, ny: 0 };
  }
  t -= height;
  if (t < width) {
    return { x: originX + width - t, y: originY + height - EDGE_INSET, nx: 0, ny: 1 };
  }
  t -= width;
  return { x: originX + EDGE_INSET, y: originY + height - t, nx: -1, ny: 0 };
}

export function createHurtSparks(
  canvasWidth: number,
  canvasHeight: number,
  count: number,
  colors: readonly string[] = DEFAULT_HURT_SPARK_COLORS,
  bounds: HurtSparkBounds = { x: 0, y: 0, width: canvasWidth, height: canvasHeight },
): HurtSpark[] {
  const particles: HurtSpark[] = [];

  for (let i = 0; i < count; i++) {
    const { x, y, nx, ny } = samplePerimeterSpawn(bounds);
    const outwardAngle = Math.atan2(ny, nx) + (Math.random() - 0.5) * OUTWARD_ANGLE_JITTER;
    const speed = 5 + Math.random() * 9;
    particles.push({
      x,
      y,
      vx: Math.cos(outwardAngle) * speed,
      vy: Math.sin(outwardAngle) * speed,
      alpha: 1,
      size: 1.5 + Math.random() * 2.5,
      color: colors[Math.floor(Math.random() * colors.length)] ?? colors[0]!,
    });
  }

  return particles;
}

function stepHurtSpark(p: HurtSpark, dt: number): void {
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.vx *= 0.94;
  p.vy *= 0.94;
}

export function animateHurtSparks(
  ctx: CanvasRenderingContext2D,
  particles: HurtSpark[],
  width: number,
  height: number,
  duration: number,
  onComplete: () => void,
): () => void {
  return animateParticleLoop({
    ctx,
    particles,
    width,
    height,
    duration,
    step: stepHurtSpark,
    draw: (c, p, progress) => {
      if (p.alpha <= 0.01) return;
      p.alpha = Math.max(0, 1 - progress * progress);
      c.save();
      c.globalAlpha = p.alpha;
      c.fillStyle = p.color;
      c.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      c.restore();
    },
    onComplete,
  });
}
