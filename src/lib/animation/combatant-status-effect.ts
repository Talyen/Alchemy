import type { ActiveCcKeyword } from "@/lib/battle";
import { keywordDefinitions } from "@/lib/game-data";
import {
  COMBATANT_FREEZE_ENCROACH_PROGRESS,
  COMBATANT_STATUS_EFFECT_PHASE_MS,
  COMBATANT_STATUS_FLAKE_COUNT,
  COMBATANT_STATUS_FROST_OPACITY,
  COMBATANT_STATUS_ORBIT_RADIUS,
  COMBATANT_STATUS_STAR_COUNT,
} from "@/lib/game-constants";
import { clamp01 } from "@/lib/math";
import { animationNoise } from "./animation-noise";
import { parseHexRgbBytes, type RgbTuple } from "./plasma-colors";

export type CombatantStatusEffectKind = "stun" | "freeze";

// Precalculated noise inputs depending only on authored particle counts.
const STAR_NOISE = Array.from({ length: COMBATANT_STATUS_STAR_COUNT }, (_, index) => animationNoise(index, 17));
const FLAKE_NOISE = Array.from({ length: COMBATANT_STATUS_FLAKE_COUNT }, (_, index) => ({
  along: animationNoise(index, 41),
  insetNoise: animationNoise(index, 47),
  delay: (index / COMBATANT_STATUS_FLAKE_COUNT) * 0.72,
}));

// Precalculated unit directions with alternating point radii for 4-spike stars.
const STAR_DIRECTIONS = Array.from({ length: 8 }, (_, index) => {
  const angle = (index * Math.PI) / 4 - Math.PI / 2;
  const radiusRatio = index % 2 === 0 ? 1 : 0.38;
  return {
    cos: Math.cos(angle) * radiusRatio,
    sin: Math.sin(angle) * radiusRatio,
  };
});

// Precalculated unit directions for the 6 symmetrical snowflake arms (60 deg increments).
const SNOWFLAKE_DIRECTIONS = Array.from({ length: 6 }, (_, index) => {
  const angle = (index * Math.PI) / 3;
  return { cos: Math.cos(angle), sin: Math.sin(angle) };
});

export interface CombatantStatusPalette {
  primary: string;
  secondary: string;
  glow: string;
  primaryRgb: RgbTuple;
  secondaryRgb: RgbTuple;
  glowRgb: RgbTuple;
}

const PALETTE_CACHE = new Map<ActiveCcKeyword, CombatantStatusPalette>();

export function combatantStatusPalette(keyword: ActiveCcKeyword): CombatantStatusPalette {
  const cached = PALETTE_CACHE.get(keyword);
  if (cached) return cached;

  const shine = keywordDefinitions[keyword].shineColors;
  const primary = shine[0] ?? "#fcd34d";
  const secondary = shine[1] ?? "#d97706";
  const glow = shine[2] ?? shine[0] ?? "#fcd34d";
  const palette: CombatantStatusPalette = {
    primary,
    secondary,
    glow,
    primaryRgb: parseHexRgbBytes(primary),
    secondaryRgb: parseHexRgbBytes(secondary),
    glowRgb: parseHexRgbBytes(glow),
  };
  PALETTE_CACHE.set(keyword, palette);
  return palette;
}

export function combatantStatusProgress(elapsedMs: number): number {
  return elapsedMs / COMBATANT_STATUS_EFFECT_PHASE_MS;
}

export function combatantStatusWobbleDegrees(kind: CombatantStatusEffectKind, progress: number): number {
  if (kind !== "stun") return 0;
  const appear = clamp01(progress / 0.12);
  if (appear <= 0.01) return 0;
  return Math.sin(progress * Math.PI * 2) * 2.2 * appear;
}

function withAlpha(color: RgbTuple, alpha: number): string {
  return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  rotation: number,
  opacity: number,
): void {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const direction = STAR_DIRECTIONS[i];
    if (!direction) continue;
    const px = x + (direction.cos * cos - direction.sin * sin) * size;
    const py = y + (direction.sin * cos + direction.cos * sin) * size;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.globalAlpha = opacity;
  ctx.fill();
  ctx.globalAlpha = opacity * 0.7;
  ctx.stroke();
}

function drawSnowflake(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  rotation: number,
  opacity: number,
): void {
  const rotCos = Math.cos(rotation);
  const rotSin = Math.sin(rotation);
  const side = radius * 0.28;

  // Pass 1: Draw diamond-shaped petals.
  ctx.beginPath();
  for (let petal = 0; petal < 6; petal++) {
    const dir = SNOWFLAKE_DIRECTIONS[petal];
    if (!dir) continue;
    const cos = dir.cos * rotCos - dir.sin * rotSin;
    const sin = dir.sin * rotCos + dir.cos * rotSin;
    const tipX = centerX + cos * radius;
    const tipY = centerY + sin * radius;
    const perpX = -sin * side;
    const perpY = cos * side;

    ctx.moveTo(centerX, centerY);
    ctx.lineTo(tipX + perpX, tipY + perpY);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(tipX - perpX, tipY - perpY);
    ctx.closePath();
  }
  ctx.globalAlpha = opacity * 0.7;
  ctx.fill();
  ctx.globalAlpha = opacity;
  ctx.stroke();

  // Pass 2: Draw the mid-arm cross branches.
  const arm = radius * 0.22;
  const midDist = radius * 0.55;

  ctx.beginPath();
  for (let petal = 0; petal < 6; petal++) {
    const dir = SNOWFLAKE_DIRECTIONS[petal];
    if (!dir) continue;
    const cos = dir.cos * rotCos - dir.sin * rotSin;
    const sin = dir.sin * rotCos + dir.cos * rotSin;
    const midX = centerX + cos * midDist;
    const midY = centerY + sin * midDist;
    const armX = -sin * arm;
    const armY = cos * arm;

    ctx.moveTo(midX + armX, midY + armY);
    ctx.lineTo(midX - armX, midY - armY);
  }
  ctx.stroke();
}

function drawSwirlingStars(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  progress: number,
  palette: CombatantStatusPalette,
): void {
  const appear = clamp01(progress / 0.12);
  if (appear <= 0.01) return;

  const minDim = Math.min(width, height);
  const radius = minDim * COMBATANT_STATUS_ORBIT_RADIUS * 0.5;
  const centerX = width * 0.5;
  const centerY = height * 0.28;
  const angleBase = progress * Math.PI * 2;

  ctx.fillStyle = palette.primary;
  ctx.strokeStyle = palette.secondary;
  ctx.lineWidth = 0.6;

  for (let index = 0; index < COMBATANT_STATUS_STAR_COUNT; index++) {
    const noise = STAR_NOISE[index] ?? 0;
    const angle = angleBase + (index / COMBATANT_STATUS_STAR_COUNT) * Math.PI * 2 + noise * 0.35;
    const radial = radius * (0.85 + noise * 0.3);
    const x = centerX + Math.cos(angle) * radial;
    const y = centerY + Math.sin(angle) * radial;
    const starSize = (4 + noise * 5) * 1.5;
    const wobble = Math.sin(progress * Math.PI * 8 + noise * Math.PI * 2) * 0.3;
    const twinkle = 0.45 + 0.55 * Math.abs(Math.sin(progress * Math.PI * 4 + noise * Math.PI * 2));
    drawStar(ctx, x, y, starSize, wobble, twinkle * appear);
  }
  ctx.globalAlpha = 1;
}

function drawIceCrystals(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  progress: number,
  palette: CombatantStatusPalette,
): void {
  const encroach = clamp01(progress / COMBATANT_FREEZE_ENCROACH_PROGRESS);
  const minDim = Math.min(width, height);
  const clearRadius = minDim * 0.55 * (1 - encroach * 0.76);
  const edgeRadius = minDim * 0.78;
  const pulse = encroach >= 1 ? 0.88 + 0.12 * (0.5 + 0.5 * Math.sin(progress * Math.PI * 2)) : 1;
  const veilOpacity = encroach * COMBATANT_STATUS_FROST_OPACITY * pulse;

  const gradient = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.max(clearRadius, 0),
    width / 2,
    height / 2,
    Math.max(edgeRadius, clearRadius + 1),
  );
  gradient.addColorStop(0, withAlpha(palette.glowRgb, 0));
  gradient.addColorStop(0.45, withAlpha(palette.glowRgb, 0.06 * veilOpacity));
  gradient.addColorStop(0.75, withAlpha(palette.primaryRgb, 0.18 * veilOpacity));
  gradient.addColorStop(1, withAlpha(palette.secondaryRgb, 0.32 * veilOpacity));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = palette.primary;
  ctx.strokeStyle = palette.secondary;
  ctx.lineWidth = 0.65;

  for (let index = 0; index < COMBATANT_STATUS_FLAKE_COUNT; index++) {
    const flake = FLAKE_NOISE[index];
    if (!flake) continue;
    const { along, insetNoise, delay } = flake;
    const edge = index % 4;
    const flakeAppear = clamp01((encroach - delay) / 0.28);
    if (flakeAppear <= 0.02) continue;

    const inset = 4 + insetNoise * 13;
    let centerX: number;
    let centerY: number;
    switch (edge) {
      case 0:
        centerX = along * width;
        centerY = inset;
        break;
      case 1:
        centerX = width - inset;
        centerY = along * height;
        break;
      case 2:
        centerX = along * width;
        centerY = height - inset;
        break;
      default:
        centerX = inset;
        centerY = along * height;
        break;
    }

    const twinkle = 0.55 + 0.45 * Math.abs(Math.sin(progress * Math.PI * 2.4 + insetNoise * Math.PI * 2));
    const breathe = 0.88 + 0.12 * twinkle;
    const flakeRadius = minDim * 0.0226 * (0.7 + insetNoise * 0.5) * flakeAppear * breathe;
    const opacity = (0.3 + 0.55 * flakeAppear * COMBATANT_STATUS_FROST_OPACITY) * twinkle;
    drawSnowflake(ctx, centerX, centerY, flakeRadius, along * Math.PI + insetNoise + progress * 0.15, opacity);
  }
  ctx.globalAlpha = 1;
}

export function drawCombatantStatusEffect(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  kind: CombatantStatusEffectKind,
  progress: number,
  palette: CombatantStatusPalette,
): void {
  ctx.clearRect(0, 0, width, height);
  if (kind === "stun") {
    drawSwirlingStars(ctx, width, height, progress, palette);
    return;
  }
  drawIceCrystals(ctx, width, height, progress, palette);
}

export function drawCombatantStatusEffectStatic(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  kind: CombatantStatusEffectKind,
  palette: CombatantStatusPalette,
): void {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = palette.primary;
  ctx.globalAlpha = kind === "stun" ? 0.12 : 0.18;
  ctx.fillRect(0, 0, width, height);
  ctx.globalAlpha = 1;
}
