// Canvas particle system for ember/dust background effects behind game screens.
// Depends on React refs for canvas mount. Used by BackgroundParticles React wrapper.
import type { MutableRefObject } from "react";

export type ParticleVariant = "embers" | "dust";

interface BackgroundParticle {
  x: number;
  y: number;
  size: number;
  alpha: number;
  baseAlpha: number;
  speed: number;
  swayAmplitude: number;
  swaySpeed: number;
  swayOffset: number;
  color: string;
}

interface BackgroundParticleConfig {
  particleCount: number;
  minSize: number;
  maxSize: number;
  minAlpha: number;
  maxAlpha: number;
  minSpeed: number;
  maxSpeed: number;
  colors: readonly string[];
}

const CONFIGS: Record<ParticleVariant, BackgroundParticleConfig> = {
  embers: {
    particleCount: 40,
    minSize: 1.5,
    maxSize: 3,
    minAlpha: 0.08,
    maxAlpha: 0.3,
    minSpeed: 3,
    maxSpeed: 8,
    colors: ["rgba(245, 196, 93, X)", "rgba(220, 160, 70, X)"],
  },
  dust: {
    particleCount: 20,
    minSize: 3,
    maxSize: 6,
    minAlpha: 0.03,
    maxAlpha: 0.1,
    minSpeed: 1,
    maxSpeed: 4,
    colors: ["rgba(200, 190, 175, X)"],
  },
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function spawnParticle(width: number, height: number, config: BackgroundParticleConfig): BackgroundParticle {
  const alpha = lerp(config.minAlpha, config.maxAlpha, Math.random());
  const rawColor = config.colors[Math.floor(Math.random() * config.colors.length)];
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    size: lerp(config.minSize, config.maxSize, Math.random()),
    alpha: 0,
    baseAlpha: alpha,
    speed: lerp(config.minSpeed, config.maxSpeed, Math.random()),
    swayAmplitude: 10 + Math.random() * 30,
    swaySpeed: 0.2 + Math.random() * 0.4,
    swayOffset: Math.random() * Math.PI * 2,
    color: rawColor.replace("X", String(alpha)),
  };
}

function updateParticle(p: BackgroundParticle, dt: number, width: number, height: number): void {
  const fadeMargin = height * 0.15;

  p.y -= p.speed * dt;
  p.x += Math.sin(p.swayOffset + performance.now() * 0.001 * p.swaySpeed) * 0.3 * dt;

  if (p.y < -fadeMargin) {
    p.y = height + fadeMargin;
    p.x = Math.random() * width;
    p.alpha = 0;
  } else if (p.y > height - fadeMargin) {
    p.alpha = lerp(0, p.baseAlpha, 1 - (p.y - (height - fadeMargin)) / fadeMargin);
  } else if (p.y < fadeMargin) {
    p.alpha = lerp(0, p.baseAlpha, p.y / fadeMargin);
  } else {
    if (p.alpha < p.baseAlpha) {
      p.alpha = Math.min(p.alpha + dt * 0.15, p.baseAlpha);
    }
  }
}

function renderParticle(ctx: CanvasRenderingContext2D, p: BackgroundParticle): void {
  ctx.globalAlpha = p.alpha;
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
  ctx.fill();
}

export function startBackgroundParticles(
  canvasRef: MutableRefObject<HTMLCanvasElement | null>,
  variant: ParticleVariant,
  colors?: readonly string[],
  alphaMultiplier?: number,
  onStop?: () => void,
): () => void {
  const canvas = canvasRef.current;
  if (!canvas) return () => {};

  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  const parent = canvas.parentElement;
  if (!parent) return () => {};
  const activeCanvas: HTMLCanvasElement = canvas;
  const activeCtx: CanvasRenderingContext2D = ctx;
  const activeParent: HTMLElement = parent;

  let running = true;
  let particles: BackgroundParticle[] = [];
  let lastTime = performance.now();
  const dpr = devicePixelRatio || 1;

  function resize() {
    const w = activeParent.clientWidth;
    const h = activeParent.clientHeight;
    activeCanvas.width = w * dpr;
    activeCanvas.height = h * dpr;
    activeCanvas.style.width = `${w}px`;
    activeCanvas.style.height = `${h}px`;
    activeCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const config = CONFIGS[variant];
    const resolvedColors = colors ?? config.colors;
    const mult = alphaMultiplier ?? 1;
    const patchedConfig = {
      ...config,
      colors: resolvedColors,
      minAlpha: config.minAlpha * mult,
      maxAlpha: config.maxAlpha * mult,
    };
    particles = Array.from({ length: config.particleCount }, () => spawnParticle(w, h, patchedConfig));
  }

  resize();

  const ro = new ResizeObserver(resize);
  ro.observe(activeParent);

  function frame(now: number) {
    if (!running) return;
    const dt = Math.min((now - lastTime) / 16.67, 3);
    lastTime = now;
    const w = activeCanvas.width / dpr;
    const h = activeCanvas.height / dpr;

    activeCtx.clearRect(0, 0, w, h);

    for (const p of particles) {
      updateParticle(p, dt, w, h);
      renderParticle(activeCtx, p);
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);

  return () => {
    running = false;
    ro.disconnect();
    onStop?.();
  };
}
