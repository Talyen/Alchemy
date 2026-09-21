import { clamp } from "./math";

interface EffectStrength {
  enabled: boolean;
  strength: number;
}

export interface BackgroundLightsSettings extends EffectStrength {
  motion: "still" | "slow" | "flowing";
}

export interface ScreenEffectsSettings {
  enabled: boolean;
  scanlines: EffectStrength & { spacing: "fine" | "normal" | "wide" };
  tint: EffectStrength & { color: "green" | "amber" | "cool" };
  edges: EffectStrength;
  grain: EffectStrength;
}

export function createDefaultScreenEffects(): ScreenEffectsSettings {
  return {
    enabled: false,
    scanlines: { enabled: false, strength: 50, spacing: "normal" },
    tint: { enabled: false, strength: 50, color: "amber" },
    edges: { enabled: false, strength: 50 },
    grain: { enabled: false, strength: 50 },
  };
}

function objectFields(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function normalizeEffectStrength(value: unknown): EffectStrength {
  const effect = objectFields(value);
  return {
    enabled: effect.enabled === true,
    strength:
      typeof effect.strength === "number" && Number.isFinite(effect.strength) ? clamp(effect.strength, 0, 100) : 50,
  };
}

export function normalizeScreenEffects(value: unknown): ScreenEffectsSettings {
  const fields = objectFields(value);
  const scanlines = objectFields(fields.scanlines);
  const tint = objectFields(fields.tint);
  return {
    enabled: fields.enabled === true,
    scanlines: {
      ...normalizeEffectStrength(scanlines),
      spacing: scanlines.spacing === "fine" || scanlines.spacing === "wide" ? scanlines.spacing : "normal",
    },
    tint: {
      ...normalizeEffectStrength(tint),
      color: tint.color === "green" || tint.color === "cool" ? tint.color : "amber",
    },
    edges: normalizeEffectStrength(fields.edges),
    grain: normalizeEffectStrength(fields.grain),
  };
}

export function createDefaultBackgroundLights(): BackgroundLightsSettings {
  return { enabled: false, strength: 50, motion: "flowing" };
}

export function normalizeBackgroundLights(value: unknown): BackgroundLightsSettings {
  const fields = objectFields(value);
  return {
    ...normalizeEffectStrength(fields),
    motion: fields.motion === "still" || fields.motion === "slow" ? fields.motion : "flowing",
  };
}
