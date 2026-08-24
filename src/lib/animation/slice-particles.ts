// Deterministic Slice sparks: cut-face spray plus silhouette/cut-edge dissolve sparks.
// Port of Trinket CombatantSliceParticles, without SwiftUI Canvas views.

import {
  SLICE_CARD_FRACTION_RANGE,
  sliceCrackPointAtFraction,
  sliceCrackPointAtFractionInSize,
  sliceCrackSide,
  sliceCrackTangentAtFraction,
  type SlicePoint,
  type SliceVec,
} from "./slice-crack";
import { sliceEffectNoise } from "./slice-noise";
import { SLICE_PARTICLE_COUNT } from "./slice-timeline";

export const SLICE_SPARK_COLOR = "rgb(185, 28, 28)";
export const SLICE_CRACK_LINE_COLOR = "rgb(226, 232, 240)";

const BORDER_DISTANCE = 110;
const BORDER_DISTANCE_VARIATION = 50;
const BORDER_DELAY = 0.12;
const BORDER_LIFETIME = 0.55;
const BORDER_LIFETIME_VARIATION = 0.2;
const BORDER_SIZE = 3;
const BORDER_SIZE_VARIATION = 2.6;
const BORDER_FADE_START = 0.2;
const BORDER_AGE_EASE = 1.8;
const BORDER_SIZE_SHRINK = 0.4;
const BORDER_FADE_EXPONENT = 1.3;

export interface SliceBorderParticle {
  origin: SlicePoint;
  direction: SliceVec;
  delayNoise: number;
  lifetimeNoise: number;
  distanceNoise: number;
  sizeNoise: number;
}

export interface SliceCutParticle {
  linePosition: number;
  side: number;
  sprayAngle: number;
  delay: number;
  speed: number;
  size: number;
  lifetime: number;
}

interface EdgeSample {
  origin: SlicePoint;
  outward: SliceVec;
}

function edgeSample(edge: number, along: number, halfSign: number): EdgeSample | null {
  if (edge === 4) {
    const origin = sliceCrackPointAtFraction(along);
    if (origin.x < 0.02 || origin.x > 0.98 || origin.y < 0.02 || origin.y > 0.98) return null;
    const tangent = sliceCrackTangentAtFraction(along);
    return {
      origin,
      outward: { dx: tangent.dy * halfSign, dy: -tangent.dx * halfSign },
    };
  }

  let origin: SlicePoint;
  let outward: SliceVec;
  switch (edge) {
    case 0:
      origin = { x: along, y: 0.02 };
      outward = { dx: 0, dy: -1 };
      break;
    case 1:
      origin = { x: 0.98, y: along };
      outward = { dx: 1, dy: 0 };
      break;
    case 2:
      origin = { x: along, y: 0.98 };
      outward = { dx: 0, dy: 1 };
      break;
    default:
      origin = { x: 0.02, y: along };
      outward = { dx: -1, dy: 0 };
      break;
  }
  if (sliceCrackSide(origin) * halfSign < 0) return null;
  return { origin, outward };
}

function makeBorderParticle(index: number, salt: number, origin: SlicePoint, outward: SliceVec): SliceBorderParticle {
  const tangent = { dx: -outward.dy, dy: outward.dx };
  const spray = (sliceEffectNoise(index + salt, 29) - 0.5) * 1.6;
  const inward = sliceEffectNoise(index + salt, 31) * 0.35;
  let dx = outward.dx * (1 - inward) + tangent.dx * spray;
  let dy = outward.dy * (1 - inward) + tangent.dy * spray;
  if (sliceEffectNoise(index + salt, 37) > 0.72) {
    const freeAngle = sliceEffectNoise(index + salt, 41) * Math.PI * 2;
    dx = Math.cos(freeAngle);
    dy = Math.sin(freeAngle);
  }
  const length = Math.max(0.001, Math.hypot(dx, dy));
  return {
    origin,
    direction: { dx: dx / length, dy: dy / length },
    delayNoise: sliceEffectNoise(index + salt, 53),
    lifetimeNoise: sliceEffectNoise(index + salt, 59),
    distanceNoise: sliceEffectNoise(index + salt, 61),
    sizeNoise: sliceEffectNoise(index + salt, 67),
  };
}

function makeSliceBorderParticles(count: number, isPrimary: boolean, salt = 0): SliceBorderParticle[] {
  const halfSign = isPrimary ? -1 : 1;
  const particles: SliceBorderParticle[] = [];
  let index = 0;
  let guardLimit = Math.max(count * 8, 1);
  while (particles.length < count && guardLimit > 0) {
    const sample = edgeSample((index + salt) % 5, sliceEffectNoise(index + salt, 13), halfSign);
    if (sample) {
      particles.push(makeBorderParticle(index, salt, sample.origin, sample.outward));
    }
    index += 1;
    guardLimit -= 1;
  }
  return particles;
}

function makeSliceCutParticles(count: number): SliceCutParticle[] {
  const particles: SliceCutParticle[] = [];
  for (let index = 0; index < count; index++) {
    particles.push({
      linePosition: (sliceEffectNoise(index, 101) - 0.5) * 1.3,
      side: index % 2 === 0 ? 1 : -1,
      sprayAngle: (sliceEffectNoise(index, 107) - 0.5) * 0.8,
      delay: sliceEffectNoise(index, 113) * 0.12,
      speed: 45 + sliceEffectNoise(index, 127) * 95,
      size: 2.5 + sliceEffectNoise(index, 131) * 3.5,
      lifetime: 0.35 + sliceEffectNoise(index, 139) * 0.35,
    });
  }
  return particles;
}

const HALF_COUNT = Math.max(SLICE_PARTICLE_COUNT / 2, 16);

export const SLICE_LEFT_BORDER_PARTICLES = makeSliceBorderParticles(HALF_COUNT, true);
export const SLICE_RIGHT_BORDER_PARTICLES = makeSliceBorderParticles(HALF_COUNT, false, 40);
export const SLICE_CUT_PARTICLES = makeSliceCutParticles(Math.max(SLICE_PARTICLE_COUNT, 32));

export interface SliceSparkSample {
  x: number;
  y: number;
  diameter: number;
  opacity: number;
}

export function sampleBorderSpark(
  particle: SliceBorderParticle,
  progress: number,
  cardWidth: number,
  cardHeight: number,
): SliceSparkSample | null {
  const distance = BORDER_DISTANCE + particle.distanceNoise * BORDER_DISTANCE_VARIATION;
  const delay = particle.delayNoise * BORDER_DELAY;
  const lifetime = BORDER_LIFETIME + particle.lifetimeNoise * BORDER_LIFETIME_VARIATION;
  const age = Math.min(Math.max((progress - delay) / Math.max(lifetime, 0.01), 0), 1);
  const easedAge = 1 - (1 - age) ** BORDER_AGE_EASE;
  const startX = particle.origin.x * cardWidth;
  const startY = particle.origin.y * cardHeight;
  const diameter = Math.max(
    0,
    (BORDER_SIZE + particle.sizeNoise * BORDER_SIZE_VARIATION) * (1 - age * BORDER_SIZE_SHRINK),
  );
  const fadeProgress = Math.max(0, (age - BORDER_FADE_START) / (1 - BORDER_FADE_START));
  const opacity = progress >= delay && age < 1 ? (1 - fadeProgress) ** BORDER_FADE_EXPONENT : 0;
  if (opacity <= 0 || diameter <= 0) return null;
  return {
    x: startX + particle.direction.dx * distance * easedAge,
    y: startY + particle.direction.dy * distance * easedAge,
    diameter,
    opacity,
  };
}

export function sampleCutSpark(
  particle: SliceCutParticle,
  crackProgress: number,
  cardWidth: number,
  cardHeight: number,
): SliceSparkSample | null {
  const age = (crackProgress - particle.delay) / particle.lifetime;
  if (age <= 0 || age >= 1) return null;
  const easedAge = 1 - (1 - age) ** 2;
  const span = SLICE_CARD_FRACTION_RANGE.end - SLICE_CARD_FRACTION_RANGE.start;
  const spanFraction = (particle.linePosition + 0.65) / 1.3;
  const fraction = SLICE_CARD_FRACTION_RANGE.start + spanFraction * span;
  const origin = sliceCrackPointAtFractionInSize(fraction, cardWidth, cardHeight);
  const tangent = sliceCrackTangentAtFraction(fraction);
  const localNormal = { dx: tangent.dy, dy: -tangent.dx };
  const sprayDx = localNormal.dx * particle.side + tangent.dx * particle.sprayAngle;
  const sprayDy = localNormal.dy * particle.side + tangent.dy * particle.sprayAngle;
  const dist = particle.speed * easedAge;
  const diameter = particle.size * (1 - 0.3 * age);
  const opacity = (1 - age) ** 1.4;
  if (diameter <= 0 || opacity <= 0) return null;
  return {
    x: origin.x + sprayDx * dist,
    y: origin.y + sprayDy * dist,
    diameter,
    opacity,
  };
}
