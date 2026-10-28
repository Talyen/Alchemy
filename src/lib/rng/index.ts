export type RandomDecision =
  | { kind: "integer"; size: number }
  | { kind: "chance"; probability: number; purpose: "effect" | "critical" | "dodge" };

/** Alternative decision sources resolve finite choices without sampling a stream. */
export type Rng = (() => number) & { decide?: (decision: RandomDecision) => number };

export type RunRngStream = "rewards" | "destinations" | "events" | "shops" | "world";

const UINT32_RANGE = 0x1_0000_0000;

const STREAM_SALTS: Record<RunRngStream, number> = {
  rewards: 0x9e37_79b9,
  destinations: 0x243f_6a88,
  events: 0xb7e1_5163,
  shops: 0x94d0_49bb,
  world: 0xdead_beef,
};

export interface RunRngState {
  seed: number;
  counters: Record<RunRngStream, number>;
}

function toUint32(value: number): number {
  return value >>> 0;
}

function mixUint32(value: number): number {
  let mixed = toUint32(value);
  mixed = Math.imul(mixed ^ (mixed >>> 16), 0x21f0_aaad);
  mixed = Math.imul(mixed ^ (mixed >>> 15), 0x735a_2d97);
  return toUint32(mixed ^ (mixed >>> 15));
}

function getRunStreamSalt(stream: RunRngStream): number {
  if (!Object.hasOwn(STREAM_SALTS, stream)) throw new Error(`Unknown run RNG stream: ${stream}`);
  return STREAM_SALTS[stream];
}

function runValueAtCounter(seed: number, salt: number, counter: number): number {
  return mixUint32(seed ^ salt ^ Math.imul(counter, 0x85eb_ca6b)) / UINT32_RANGE;
}

function assertDraw(draw: number): number {
  if (!(draw >= 0 && draw < 1)) throw new Error("Rng draw out of range");
  return draw;
}

export function hashStringToUint32(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createSeededRng(seed: number): Rng {
  let s = toUint32(seed);
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / UINT32_RANGE;
  };
}

export function createRunRngState(seed: number): RunRngState {
  if (!Number.isFinite(seed)) throw new Error("createRunRngState requires a finite seed");
  return {
    seed: toUint32(Math.trunc(seed)),
    counters: {
      rewards: 0,
      destinations: 0,
      events: 0,
      shops: 0,
      world: 0,
    },
  };
}

export function stepRunRng(state: RunRngState, stream: RunRngStream): number {
  const salt = getRunStreamSalt(stream);
  // The hash uses only 32 bits. Wrap the stored counter too, before floating-point
  // increments can stall, without changing any draw in the existing sequence.
  const nextCounter = toUint32((state.counters[stream] ?? 0) + 1);
  state.counters[stream] = nextCounter;
  return runValueAtCounter(state.seed, salt, nextCounter);
}

export function createRunStateRng(state: RunRngState, stream: RunRngStream): Rng {
  return () => stepRunRng(state, stream);
}

export function rngInt(rng: Rng, n: number): number {
  if (!Number.isInteger(n) || n <= 0) throw new Error("rngInt requires a positive integer range");
  if (rng.decide) {
    const chosen = rng.decide({ kind: "integer", size: n });
    if (!Number.isInteger(chosen) || chosen < 0 || chosen >= n) throw new Error("Invalid integer decision");
    return chosen;
  }
  return Math.floor(assertDraw(rng()) * n);
}

export function createRunStreamRng(seed: number, stream: RunRngStream = "world", startCounter = 0): Rng {
  if (!Number.isFinite(seed)) throw new Error("createRunStreamRng requires a finite seed");
  if (!Number.isSafeInteger(startCounter) || startCounter < 0)
    throw new Error("createRunStreamRng requires a non-negative integer startCounter");
  const salt = getRunStreamSalt(stream);
  const seed32 = toUint32(seed);
  let counter = startCounter;
  return () => {
    counter = toUint32(counter + 1);
    return runValueAtCounter(seed32, salt, counter);
  };
}

/** Fail-fast stub for inactive battle states. Like the inspection and scoring
 * seams, it throws on draw instead of returning a misleading constant. */
export const placeholderRng: Rng = () => {
  throw new Error("BattleState.rng is required for outcome rolls");
};

export function rollChance(
  probability: number,
  rng: Rng,
  purpose: "effect" | "critical" | "dodge" = "effect",
): boolean {
  if (Number.isNaN(probability)) throw new Error("rollChance requires a number");
  if (probability <= 0) return false;
  if (probability >= 1) return true;
  if (rng.decide) {
    const chosen = rng.decide({ kind: "chance", probability, purpose });
    if (chosen !== 0 && chosen !== 1) throw new Error("Invalid chance decision");
    return chosen === 1;
  }
  return assertDraw(rng()) < probability;
}

export function rollPercent(chance: number, rng: Rng, purpose: "effect" | "critical" | "dodge" = "effect"): boolean {
  return rollChance(chance / 100, rng, purpose);
}

export function getBattleRng(state: { rng?: Rng }): Rng {
  if (!state.rng) throw new Error("BattleState.rng is required for outcome rolls");
  return state.rng;
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  return shuffleInPlace([...items], rng);
}

/** Shuffle an array owned by the caller, preserving the same draws as shuffle. */
export function shuffleInPlace<T>(items: T[], rng: Rng): T[] {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = rngInt(rng, index + 1);
    const item = items[index]!;
    items[index] = items[swapIndex]!;
    items[swapIndex] = item;
  }
  return items;
}

function validateSampleCount(count: number): void {
  if (!Number.isInteger(count) || count < 0) throw new Error("sampleItems requires a non-negative integer count");
}

export function sampleItems<T>(items: readonly T[], count: number, rng: Rng): T[] {
  validateSampleCount(count);
  if (count === 0) return [];
  return sampleOwned([...items], count, rng);
}

function sampleOwned<T>(items: T[], count: number, rng: Rng): T[] {
  // Keep the full shuffle: even a small sample must preserve seeded results
  // and the stream position used by subsequent rewards and encounters.
  shuffleInPlace(items, rng);
  items.length = Math.min(count, items.length);
  return items;
}

export function pickRandom<T>(items: readonly T[], rng: Rng): T | undefined {
  if (items.length === 0) return undefined;
  return items[rngInt(rng, items.length)];
}

/** Half-open weighted buckets in item order; empty or all-zero pools do not draw. */
export function pickWeighted<T>(items: readonly T[], weightOf: (item: T) => number, rng: Rng): T | undefined {
  const weights = items.map(weightOf);
  let total = 0;
  let lastPositiveIndex = -1;
  for (let index = 0; index < weights.length; index++) {
    const weight = weights[index]!;
    if (!Number.isFinite(weight) || weight < 0) throw new Error("pickWeighted requires finite non-negative weights");
    total += weight;
    if (weight > 0) lastPositiveIndex = index;
  }
  if (!Number.isFinite(total)) throw new Error("pickWeighted requires a finite total weight");
  if (lastPositiveIndex < 0) return undefined;

  let remaining = assertDraw(rng()) * total;
  for (let index = 0; index < weights.length; index++) {
    const weight = weights[index]!;
    if (weight === 0) continue;
    remaining -= weight;
    if (remaining < 0) return items[index];
  }
  // Floating-point subtraction can exhaust the buckets; never select a zero-weight tail.
  return items[lastPositiveIndex];
}

/** Sample without replacement while skipping excluded keys (e.g. owned or currently shown items). */
export function sampleItemsExcluding<T, K>(
  items: readonly T[],
  count: number,
  rng: Rng,
  exclude: ReadonlySet<K>,
  keyOf: (item: T) => K,
): T[] {
  validateSampleCount(count);
  if (count === 0) return [];
  const eligible = items.filter((item) => !exclude.has(keyOf(item)));
  return sampleOwned(eligible, count, rng);
}

export function takeRandomItem<T>(items: T[], rng: Rng): T | undefined {
  if (items.length === 0) return undefined;
  const index = rngInt(rng, items.length);
  const [removed] = items.splice(index, 1);
  return removed;
}
