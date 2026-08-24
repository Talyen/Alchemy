// Progress → Slice visual state. Timing matches Trinket CombatantSliceEffectConfig.

import { SLICE_NORMAL } from "./slice-crack";

const SLICE_INTENSITY = 0.5;
export const SLICE_PARTICLE_COUNT = 48;
const SLICE_TINT_STRENGTH = 0.85;
const SLICE_SPLIT_GAP = 0.22;
const SLICE_CRACK_GAP = 0.035;
const SLICE_CRACK_DRAW_DURATION = 0.08;
export const SLICE_CRACK_OPEN_START = 0.08;
export const SLICE_SPLIT_DELAY = 0.3;

export interface SliceOffset {
  x: number;
  y: number;
}

export interface SliceVisual {
  crackT: number;
  splitT: number;
  gap: number;
  lift: number;
  twistDeg: number;
  dissolve: number;
  halfOpacity: number;
  crackDraw: number;
  lineOpacity: number;
  leftOffset: SliceOffset;
  rightOffset: SliceOffset;
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

export function computeSliceVisual(progress: number, width: number, height: number): SliceVisual {
  const p = clamp01(progress);
  const delay = SLICE_SPLIT_DELAY;
  const crackT = clamp01((p - SLICE_CRACK_OPEN_START) / 0.06);
  const crackGapAmount = width * SLICE_CRACK_GAP * crackT * SLICE_INTENSITY;
  const rawSplitT = delay >= 1 ? 0 : clamp01((p - delay) / (1 - delay));
  const splitT = 1 - (1 - rawSplitT) ** 3;
  const gap = crackGapAmount + width * Math.max(SLICE_SPLIT_GAP - SLICE_CRACK_GAP, 0) * splitT * SLICE_INTENSITY;
  const lift = height * 0.08 * splitT * SLICE_INTENSITY;
  const twistDeg = 7 * splitT * SLICE_INTENSITY;
  const dissolve = rawSplitT ** 2.6;
  const halfOpacity = 1 - dissolve;
  const drawDuration = Math.min(SLICE_CRACK_DRAW_DURATION, Math.max(delay, 0.001));
  const crackDraw = clamp01(p / drawDuration);
  const fade = 1 - clamp01((p - delay) / 0.18);
  const lineOpacity = fade * Math.max(SLICE_INTENSITY, 0.35) * (0.55 + SLICE_TINT_STRENGTH * 0.7);

  return {
    crackT,
    splitT,
    gap,
    lift,
    twistDeg,
    dissolve,
    halfOpacity,
    crackDraw,
    lineOpacity,
    leftOffset: {
      x: -SLICE_NORMAL.dx * gap * 0.5,
      y: -SLICE_NORMAL.dy * gap * 0.5 - lift,
    },
    rightOffset: {
      x: SLICE_NORMAL.dx * gap * 0.5,
      y: SLICE_NORMAL.dy * gap * 0.5 + lift,
    },
  };
}
