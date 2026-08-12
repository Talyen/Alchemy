// Canvas particle system for ember/dust background effects behind game screens.
// Depends on React refs for canvas mount. Used by BackgroundParticles React wrapper.
import type { RefObject } from "react";

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

function resolveParticleBackingScale(width: number, height: number, requestedScale: number): number {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const pixelLimitedScale = Math.sqrt(MAX_PARTICLE_BACKING_PIXELS / (safeWidth * safeHeight));
  return Math.max(1, Math.min(requestedScale, MAX_PARTICLE_BACKING_SCALE, pixelLimitedScale));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function spawnParticle(width: number, height: number, config: BackgroundParticleConfig): BackgroundParticle {
  const alpha = lerp(config.minAlpha, config.maxAlpha, Math.random());
  const rawColor = config.colors[Math.floor(Math.random() * config.colors.length)];
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
  canvasRef: RefObject<HTMLCanvasElement | null>,
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
  let backingScale = 1;
  let logicalWidth = 0;
  let logicalHeight = 0;
  const config = CONFIGS[variant];
  const resolvedColors = (colors ?? config.colors).map((c) => c.replace("X", "1"));
  const mult = alphaMultiplier ?? 1;
  const patchedConfig = {
    ...config,
    colors: resolvedColors,
    minAlpha: config.minAlpha * mult,
    maxAlpha: config.maxAlpha * mult,
  };

  function resize() {
    const w = activeParent.clientWidth;
    const h = activeParent.clientHeight;
    backingScale = resolveParticleBackingScale(w, h, devicePixelRatio || 1);
    activeCanvas.width = Math.max(1, Math.round(w * backingScale));
    activeCanvas.height = Math.max(1, Math.round(h * backingScale));
    activeCanvas.style.width = `${w}px`;
    activeCanvas.style.height = `${h}px`;
    activeCtx.setTransform(backingScale, 0, 0, backingScale, 0, 0);
    if (particles.length === 0) {
      particles = Array.from({ length: config.particleCount }, () => spawnParticle(w, h, patchedConfig));
    } else if (logicalWidth > 0 && logicalHeight > 0 && (w !== logicalWidth || h !== logicalHeight)) {
      const scaleX = w / logicalWidth;
      const scaleY = h / logicalHeight;
      for (const p of particles) {
        p.x *= scaleX;
        p.y *= scaleY;
      }
    }
    logicalWidth = w;
    logicalHeight = h;
  }

  resize();

  const ro = new ResizeObserver(resize);
  ro.observe(activeParent);

  let animFrameId: number | null = null;

  // Pause when the document is hidden, the window is unfocused, or the canvas has no
  // rendered size — the rAF loop is parked (not merely skipping draws) and resumed on
  // the matching events, mirroring the audio mute logic.
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
    const w = activeCanvas.width / backingScale;
    const h = activeCanvas.height / backingScale;

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
