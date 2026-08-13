// Jagged Slice crack in unit space, shared by half-plane clip-paths, the drawn
// fissure, and cut-face sparks. Landscape enemy art uses a 4:3 aspect so the
// diagonal still spans the portrait. Port of Trinket CombatantSliceCrack.

import { sliceEffectNoise } from "./slice-noise";

export interface SlicePoint {
  x: number;
  y: number;
}

export interface SliceVec {
  dx: number;
  dy: number;
}

const SLICE_ANGLE_DEGREES = -30;
export const SLICE_ANGLE_RADIANS = (SLICE_ANGLE_DEGREES * Math.PI) / 180;

const SLICE_ALONG: SliceVec = {
  dx: Math.sin(SLICE_ANGLE_RADIANS),
  dy: Math.cos(SLICE_ANGLE_RADIANS),
};

export const SLICE_NORMAL: SliceVec = {
  dx: Math.cos(SLICE_ANGLE_RADIANS),
  dy: -Math.sin(SLICE_ANGLE_RADIANS),
};

/** 4:3 landscape enemy art (Trinket used 192×256 portrait). */
export const SLICE_ASPECT_WIDTH = 256;
export const SLICE_ASPECT_HEIGHT = 192;
const SLICE_SEGMENT_COUNT = 5;
const SLICE_WOBBLE = 16;
const END_PADDING = 24;

function cardSpanOffsets(): { min: number; max: number } {
  const offsets: number[] = [];
  for (const boundary of [0, 1]) {
    const d = ((boundary - 0.5) * SLICE_ASPECT_WIDTH) / SLICE_ALONG.dx;
    const unitY = 0.5 + (SLICE_ALONG.dy * d) / SLICE_ASPECT_HEIGHT;
    if (unitY >= 0 && unitY <= 1) offsets.push(d);
  }
  for (const boundary of [0, 1]) {
    const d = ((boundary - 0.5) * SLICE_ASPECT_HEIGHT) / SLICE_ALONG.dy;
    const unitX = 0.5 + (SLICE_ALONG.dx * d) / SLICE_ASPECT_WIDTH;
    if (unitX >= 0 && unitX <= 1) offsets.push(d);
  }
  return { min: Math.min(...offsets), max: Math.max(...offsets) };
}

function basePoint(aspectOffset: number): SlicePoint {
  return {
    x: 0.5 + (SLICE_ALONG.dx * aspectOffset) / SLICE_ASPECT_WIDTH,
    y: 0.5 + (SLICE_ALONG.dy * aspectOffset) / SLICE_ASPECT_HEIGHT,
  };
}

function offsetPoint(aspectOffset: number, perpendicular: number): SlicePoint {
  return {
    x: 0.5 + (SLICE_ALONG.dx * aspectOffset + SLICE_NORMAL.dx * perpendicular) / SLICE_ASPECT_WIDTH,
    y: 0.5 + (SLICE_ALONG.dy * aspectOffset + SLICE_NORMAL.dy * perpendicular) / SLICE_ASPECT_HEIGHT,
  };
}

function buildPoints(): SlicePoint[] {
  const span = cardSpanOffsets();
  const vertices: SlicePoint[] = [basePoint(span.min - END_PADDING)];
  const interiorCount = SLICE_SEGMENT_COUNT - 1;
  for (let index = 1; index <= interiorCount; index++) {
    const fraction = index / SLICE_SEGMENT_COUNT;
    const aspectOffset = span.min + (span.max - span.min) * fraction;
    const noise = sliceEffectNoise(index, 211);
    const offset = SLICE_WOBBLE * (0.5 + 0.5 * noise) * (index % 2 === 0 ? 1 : -1);
    vertices.push(offsetPoint(aspectOffset, offset));
  }
  vertices.push(basePoint(span.max + END_PADDING));
  return vertices;
}

export const SLICE_CRACK_POINTS: readonly SlicePoint[] = buildPoints();

function segmentAspectLength(index: number): number {
  const a = SLICE_CRACK_POINTS[index]!;
  const b = SLICE_CRACK_POINTS[index + 1]!;
  return Math.hypot((b.x - a.x) * SLICE_ASPECT_WIDTH, (b.y - a.y) * SLICE_ASPECT_HEIGHT);
}

const CUMULATIVE_ASPECT_LENGTHS: number[] = (() => {
  const lengths = [0];
  let running = 0;
  for (let index = 0; index < SLICE_CRACK_POINTS.length - 1; index++) {
    running += segmentAspectLength(index);
    lengths.push(running);
  }
  return lengths;
})();

const SLICE_CRACK_TOTAL_ASPECT_LENGTH = CUMULATIVE_ASPECT_LENGTHS[CUMULATIVE_ASPECT_LENGTHS.length - 1]!;

export const SLICE_CARD_FRACTION_RANGE = {
  start: END_PADDING / SLICE_CRACK_TOTAL_ASPECT_LENGTH,
  end: 1 - END_PADDING / SLICE_CRACK_TOTAL_ASPECT_LENGTH,
} as const;

export function sliceCrackPointAtFraction(fraction: number): SlicePoint {
  const lead = Math.min(Math.max(fraction, 0), 1);
  const target = lead * SLICE_CRACK_TOTAL_ASPECT_LENGTH;
  for (let index = 0; index < SLICE_CRACK_POINTS.length - 1; index++) {
    const start = CUMULATIVE_ASPECT_LENGTHS[index]!;
    const end = CUMULATIVE_ASPECT_LENGTHS[index + 1]!;
    if (target <= end) {
      const a = SLICE_CRACK_POINTS[index]!;
      const b = SLICE_CRACK_POINTS[index + 1]!;
      const local = end > start ? (target - start) / (end - start) : 0;
      return { x: a.x + (b.x - a.x) * local, y: a.y + (b.y - a.y) * local };
    }
  }
  return SLICE_CRACK_POINTS[SLICE_CRACK_POINTS.length - 1]!;
}

export function sliceCrackPointAtFractionInSize(fraction: number, width: number, height: number): SlicePoint {
  const unit = sliceCrackPointAtFraction(fraction);
  return { x: unit.x * width, y: unit.y * height };
}

export function sliceCrackPolylineToFraction(fraction: number, width: number, height: number): SlicePoint[] {
  const lead = Math.min(Math.max(fraction, 0), 1);
  const first = SLICE_CRACK_POINTS[0]!;
  const result: SlicePoint[] = [{ x: first.x * width, y: first.y * height }];
  if (lead <= 0) return result;
  const target = lead * SLICE_CRACK_TOTAL_ASPECT_LENGTH;
  let remaining = target;
  for (let index = 0; index < SLICE_CRACK_POINTS.length - 1; index++) {
    const a = SLICE_CRACK_POINTS[index]!;
    const b = SLICE_CRACK_POINTS[index + 1]!;
    const segmentLength = segmentAspectLength(index);
    if (segmentLength <= remaining) {
      result.push({ x: b.x * width, y: b.y * height });
      remaining -= segmentLength;
    } else {
      const local = segmentLength > 0 ? remaining / segmentLength : 0;
      result.push({
        x: (a.x + (b.x - a.x) * local) * width,
        y: (a.y + (b.y - a.y) * local) * height,
      });
      break;
    }
  }
  return result;
}

export function sliceCrackTangentAtFraction(fraction: number): SliceVec {
  const lead = Math.min(Math.max(fraction, 0), 1);
  const target = lead * SLICE_CRACK_TOTAL_ASPECT_LENGTH;
  const lastIndex = SLICE_CRACK_POINTS.length - 2;
  let segmentIndex = lastIndex;
  for (let index = 0; index < lastIndex; index++) {
    if (target <= CUMULATIVE_ASPECT_LENGTHS[index + 1]!) {
      segmentIndex = index;
      break;
    }
  }
  const a = SLICE_CRACK_POINTS[segmentIndex]!;
  const b = SLICE_CRACK_POINTS[segmentIndex + 1]!;
  const dx = (b.x - a.x) * SLICE_ASPECT_WIDTH;
  const dy = (b.y - a.y) * SLICE_ASPECT_HEIGHT;
  const length = Math.hypot(dx, dy);
  if (length <= 0) return SLICE_ALONG;
  return { dx: dx / length, dy: dy / length };
}

/** Signed distance to the crack. Negative on the primary (−normal) side. */
export function sliceCrackSide(point: SlicePoint): number {
  const px = point.x * SLICE_ASPECT_WIDTH;
  const py = point.y * SLICE_ASPECT_HEIGHT;
  let nearestDistance = Number.POSITIVE_INFINITY;
  let nearestSign = 1;
  for (let index = 0; index < SLICE_CRACK_POINTS.length - 1; index++) {
    const a = SLICE_CRACK_POINTS[index]!;
    const b = SLICE_CRACK_POINTS[index + 1]!;
    const ax = a.x * SLICE_ASPECT_WIDTH;
    const ay = a.y * SLICE_ASPECT_HEIGHT;
    const bx = b.x * SLICE_ASPECT_WIDTH;
    const by = b.y * SLICE_ASPECT_HEIGHT;
    const abx = bx - ax;
    const aby = by - ay;
    const apx = px - ax;
    const apy = py - ay;
    const abLength2 = abx * abx + aby * aby;
    if (abLength2 <= 0) continue;
    const local = Math.min(Math.max((apx * abx + apy * aby) / abLength2, 0), 1);
    const closestX = ax + abx * local;
    const closestY = ay + aby * local;
    const dx = px - closestX;
    const dy = py - closestY;
    const distance = Math.hypot(dx, dy);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestSign = dx * SLICE_NORMAL.dx + dy * SLICE_NORMAL.dy >= 0 ? 1 : -1;
    }
  }
  return nearestDistance * nearestSign;
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(3)}%`;
}

/** CSS clip-path polygon for one half-plane of the jagged crack. */
function sliceCrackHalfClipPath(isPrimary: boolean): string {
  const sign = isPrimary ? -1 : 1;
  const maxDim = Math.max(SLICE_ASPECT_WIDTH, SLICE_ASPECT_HEIGHT);
  const farX = (SLICE_NORMAL.dx * maxDim * 2.2 * sign) / SLICE_ASPECT_WIDTH;
  const farY = (SLICE_NORMAL.dy * maxDim * 2.2 * sign) / SLICE_ASPECT_HEIGHT;
  const first = SLICE_CRACK_POINTS[0]!;
  const last = SLICE_CRACK_POINTS[SLICE_CRACK_POINTS.length - 1]!;
  const verts = [
    ...SLICE_CRACK_POINTS,
    { x: last.x + farX, y: last.y + farY },
    { x: first.x + farX, y: first.y + farY },
  ];
  return `polygon(${verts.map((p) => `${formatPct(p.x)} ${formatPct(p.y)}`).join(", ")})`;
}

export const SLICE_PRIMARY_CLIP_PATH = sliceCrackHalfClipPath(true);
export const SLICE_SECONDARY_CLIP_PATH = sliceCrackHalfClipPath(false);
