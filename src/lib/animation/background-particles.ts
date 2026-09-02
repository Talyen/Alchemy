import { clamp, lerp, pickRandomUnsafe } from "../utils";

export type ParticleVariant = "embers" | "dust" | "hand_glow";

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
  spawnBottomWeight?: number;
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
  hand_glow: {
    particleCount: 25,
    minSize: 1.5,
    maxSize: 3,
    minAlpha: 0.2,
    maxAlpha: 0.5,
    minSpeed: 2,
    maxSpeed: 5,
    colors: ["rgba(255, 200, 80, X)", "rgba(255, 160, 40, X)"],
    spawnBottomWeight: 0.7,
  },
};

const MAX_PARTICLE_BACKING_SCALE = 1.5;
const MAX_PARTICLE_BACKING_PIXELS = 3_000_000;
const MIN_PARTICLE_BACKING_SCALE = 0.25;

function resolveParticleBackingScale(width: number, height: number, requestedScale: number): number {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const pixelLimitedScale = Math.sqrt(MAX_PARTICLE_BACKING_PIXELS / (safeWidth * safeHeight));
  return clamp(Math.min(requestedScale, pixelLimitedScale), MIN_PARTICLE_BACKING_SCALE, MAX_PARTICLE_BACKING_SCALE);
}

function spawnParticle(width: number, height: number, config: BackgroundParticleConfig): BackgroundParticle {
  const alpha = lerp(config.minAlpha, config.maxAlpha, Math.random());
  const rawColor = pickRandomUnsafe(config.colors);
  const y = config.spawnBottomWeight
    ? height - Math.random() * height * (1 - config.spawnBottomWeight)
    : Math.random() * height;
  return {
    x: Math.random() * width,
    y,
    size: lerp(config.minSize, config.maxSize, Math.random()),
    alpha: 0,
    baseAlpha: alpha,
    speed: lerp(config.minSpeed, config.maxSpeed, Math.random()),
    swayAmplitude: 10 + Math.random() * 30,
    swaySpeed: 0.2 + Math.random() * 0.4,
    swayOffset: Math.random() * Math.PI * 2,
    color: rawColor ?? "rgba(255, 200, 80, 1)",
  };
}

function updateParticle(p: BackgroundParticle, dt: number, now: number, width: number, height: number): void {
  const fadeMargin = height * 0.15;

  p.y -= p.speed * dt;
  p.x += Math.sin(p.swayOffset + now * 0.001 * p.swaySpeed) * 0.3 * dt;

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
  canvasRef: { current: HTMLCanvasElement | null },
  variant: ParticleVariant,
  colors?: readonly string[],
  alphaMultiplier?: number,
  particleCount?: number,
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
  let logicalWidth = 0;
  let logicalHeight = 0;
  let animFrameId: number | null = null;
  const config = CONFIGS[variant];
  const resolvedColors = (colors ?? config.colors).map((c) => c.replace("X", "1"));
  const mult = alphaMultiplier ?? 1;
  const patchedConfig = {
    ...config,
    colors: resolvedColors,
    minAlpha: config.minAlpha * mult,
    maxAlpha: config.maxAlpha * mult,
    particleCount: particleCount ?? config.particleCount,
  };

  function resize() {
    const w = activeParent.clientWidth;
    const h = activeParent.clientHeight;
    activeCanvas.style.width = `${w}px`;
    activeCanvas.style.height = `${h}px`;
    if (w <= 0 || h <= 0) {
      activeCanvas.width = 1;
      activeCanvas.height = 1;
      logicalWidth = 0;
      logicalHeight = 0;
      return;
    }

    const backingScale = resolveParticleBackingScale(w, h, devicePixelRatio || 1);
    activeCanvas.width = Math.max(1, Math.floor(w * backingScale));
    activeCanvas.height = Math.max(1, Math.floor(h * backingScale));
    activeCtx.setTransform(activeCanvas.width / w, 0, 0, activeCanvas.height / h, 0, 0);
    if (particles.length === 0 || logicalWidth <= 0 || logicalHeight <= 0) {
      particles = Array.from({ length: patchedConfig.particleCount }, () => spawnParticle(w, h, patchedConfig));
    } else if (w !== logicalWidth || h !== logicalHeight) {
      const scaleX = w / logicalWidth;
      const scaleY = h / logicalHeight;
      for (const p of particles) {
        p.x *= scaleX;
        p.y *= scaleY;
      }
    }
    logicalWidth = w;
    logicalHeight = h;
    scheduleFrame();
  }

  resize();

  const ro = new ResizeObserver(resize);
  ro.observe(activeParent);

  function isPaused() {
    return document.hidden || !document.hasFocus() || activeCanvas.width < 2 || activeCanvas.height < 2;
  }

  function scheduleFrame() {
    if (!running || isPaused() || animFrameId !== null) return;
    animFrameId = requestAnimationFrame(frame);
  }

  function frame(now: number) {
    animFrameId = null;
    if (!running || isPaused()) {
      lastTime = now;
      return;
    }
    const dt = Math.min((now - lastTime) / 16.67, 3);
    lastTime = now;
    const w = logicalWidth;
    const h = logicalHeight;

    activeCtx.clearRect(0, 0, w, h);

    for (const p of particles) {
      updateParticle(p, dt, now, w, h);
      renderParticle(activeCtx, p);
    }

    scheduleFrame();
  }

  function resume() {
    if (!running || animFrameId !== null) return;
    lastTime = performance.now();
    scheduleFrame();
  }

  function handleVisibilityChange() {
    if (!document.hidden && running) resume();
  }

  function handleWindowBlur() {
    if (animFrameId !== null) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
  }

  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("blur", handleWindowBlur);
  window.addEventListener("focus", resume);
  scheduleFrame();

  return () => {
    running = false;
    if (animFrameId !== null) cancelAnimationFrame(animFrameId);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("blur", handleWindowBlur);
    window.removeEventListener("focus", resume);
    ro.disconnect();
    onStop?.();
  };
}
