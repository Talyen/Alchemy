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

export type CombatantStatusEffectKind = "stun" | "freeze";

export interface CombatantStatusPalette {
  primary: string;
  secondary: string;
  glow: string;
}

export function combatantStatusPalette(keyword: ActiveCcKeyword): CombatantStatusPalette {
  const shine = keywordDefinitions[keyword].shineColors;
  return {
    primary: shine[0] ?? "#fcd34d",
    secondary: shine[1] ?? "#d97706",
    glow: shine[2] ?? shine[0] ?? "#fcd34d",
  };
}

export function combatantStatusProgress(elapsedMs: number): number {
  return elapsedMs / COMBATANT_STATUS_EFFECT_PHASE_MS;
}

export function combatantCardEffectNoise(index: number, salt: number): number {
  const n = Math.sin(index * 12989 + salt * 78433) * 43758.5453;
  return n - Math.floor(n);
}

export function combatantStatusWobbleDegrees(kind: CombatantStatusEffectKind, progress: number): number {
  if (kind !== "stun") return 0;
  const appear = Math.min(Math.max(progress / 0.12, 0), 1);
  if (appear <= 0.01) return 0;
  return Math.sin(progress * Math.PI * 2) * 2.2 * appear;
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  primary: string,
  secondary: string,
  opacity: number,
): void {
  const spikes = 4;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const angle = (i * Math.PI) / spikes - Math.PI / 2;
    const radius = i % 2 === 0 ? size : size * 0.38;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = withAlpha(primary, opacity);
  ctx.fill();
  ctx.strokeStyle = withAlpha(secondary, opacity * 0.7);
  ctx.lineWidth = 0.6;
  ctx.stroke();
}

function drawSnowflake(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  rotation: number,
  primary: string,
  secondary: string,
  opacity: number,
): void {
  const petals = 6;
  for (let petal = 0; petal < petals; petal++) {
    const angle = (petal / petals) * Math.PI * 2 + rotation;
    const tipX = centerX + Math.cos(angle) * radius;
    const tipY = centerY + Math.sin(angle) * radius;
    const side = radius * 0.28;
    const perpX = -Math.sin(angle);
    const perpY = Math.cos(angle);

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(tipX + perpX * side, tipY + perpY * side);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(tipX - perpX * side, tipY - perpY * side);
    ctx.closePath();
    ctx.fillStyle = withAlpha(primary, opacity * 0.7);
    ctx.fill();
    ctx.strokeStyle = withAlpha(secondary, opacity);
    ctx.lineWidth = 0.65;
    ctx.stroke();

    const midX = centerX + Math.cos(angle) * radius * 0.55;
    const midY = centerY + Math.sin(angle) * radius * 0.55;
    const arm = radius * 0.22;
    ctx.beginPath();
    ctx.moveTo(midX + perpX * arm, midY + perpY * arm);
    ctx.lineTo(midX - perpX * arm, midY - perpY * arm);
    ctx.stroke();
  }
}

function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return hex;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function drawSwirlingStars(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  progress: number,
  palette: CombatantStatusPalette,
): void {
  const appear = Math.min(Math.max(progress / 0.12, 0), 1);
  if (appear <= 0.01) return;

  const minDim = Math.min(width, height);
  const radius = minDim * COMBATANT_STATUS_ORBIT_RADIUS * 0.5;
  const centerX = width * 0.5;
  const centerY = height * 0.28;
  const angleBase = progress * Math.PI * 2;

  for (let index = 0; index < COMBATANT_STATUS_STAR_COUNT; index++) {
    const noise = combatantCardEffectNoise(index, 17);
    const angle = angleBase + (index / COMBATANT_STATUS_STAR_COUNT) * Math.PI * 2 + noise * 0.35;
    const radial = radius * (0.85 + noise * 0.3);
    const x = centerX + Math.cos(angle) * radial;
    const y = centerY + Math.sin(angle) * radial;
    const starSize = 4 + noise * 5;
    const twinkle = 0.45 + 0.55 * Math.abs(Math.sin(progress * Math.PI * 4 + noise * Math.PI * 2));
    drawStar(ctx, x, y, starSize, palette.primary, palette.secondary, twinkle * appear);
  }
}

function drawIceCrystals(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  progress: number,
  palette: CombatantStatusPalette,
): void {
  const encroach = Math.min(Math.max(progress / COMBATANT_FREEZE_ENCROACH_PROGRESS, 0), 1);
  const minDim = Math.min(width, height);
  const crackDensity = 0.7;
  const clearRadius = minDim * 0.55 * (1 - encroach * (0.55 + crackDensity * 0.3));
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
  gradient.addColorStop(0, withAlpha(palette.glow, 0));
  gradient.addColorStop(0.45, withAlpha(palette.glow, 0.06 * veilOpacity));
  gradient.addColorStop(0.75, withAlpha(palette.primary, 0.18 * veilOpacity));
  gradient.addColorStop(1, withAlpha(palette.secondary, 0.32 * veilOpacity));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  for (let index = 0; index < COMBATANT_STATUS_FLAKE_COUNT; index++) {
    const along = combatantCardEffectNoise(index, 41);
    const edge = index % 4;
    const delay = (index / COMBATANT_STATUS_FLAKE_COUNT) * 0.72;
    const flakeAppear = Math.min(Math.max((encroach - delay) / 0.28, 0), 1);
    if (flakeAppear <= 0.02) continue;

    const insetNoise = combatantCardEffectNoise(index, 47);
    const inset = 4 + insetNoise * (6 + crackDensity * 10);
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
    const flakeRadius = minDim * (0.01 + crackDensity * 0.018) * (0.7 + insetNoise * 0.5) * flakeAppear * breathe;
    const opacity = (0.3 + 0.55 * flakeAppear * COMBATANT_STATUS_FROST_OPACITY) * twinkle;
    drawSnowflake(
      ctx,
      centerX,
      centerY,
      flakeRadius,
      along * Math.PI + insetNoise + progress * 0.15,
      palette.primary,
      palette.secondary,
      opacity,
    );
  }
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
  ctx.fillStyle = withAlpha(palette.primary, kind === "stun" ? 0.12 : 0.18);
  ctx.fillRect(0, 0, width, height);
}
