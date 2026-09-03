export type Rng = () => number;

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

export function createRunRngState(rng: Rng): RunRngState {
  const raw = rng();
  const seed = raw >= 0 && raw < 1 ? toUint32(Math.trunc(raw * UINT32_RANGE)) : 0;
  return {
    seed,
    counters: {
      rewards: 0,
      destinations: 0,
      events: 0,
      shops: 0,
      world: 0,
    },
  };
}

export function nextRunRngValue(state: RunRngState, stream: RunRngStream): { value: number; nextCounter: number } {
  const counter = state.counters[stream] ?? 0;
  if (!(stream in STREAM_SALTS)) {
    throw new Error(`Unknown run RNG stream: ${stream}`);
  }
  const value = mixUint32(state.seed ^ STREAM_SALTS[stream] ^ Math.imul(counter + 1, 0x85eb_ca6b)) / UINT32_RANGE;
  return { value, nextCounter: counter + 1 };
}

export function rngInt(rng: Rng, n: number): number {
  if (!Number.isInteger(n) || n <= 0) throw new Error("rngInt requires a positive integer range");
  return Math.floor(assertDraw(rng()) * n);
}

export function createRunStreamRng(seed: number, stream: RunRngStream = "world", startCounter = 0): Rng {
  if (!Number.isInteger(startCounter) || startCounter < 0)
    throw new Error("createRunStreamRng requires a non-negative integer startCounter");
  const state: RunRngState = {
    seed: toUint32(seed),
    counters: {
      rewards: stream === "rewards" ? startCounter : 0,
      destinations: stream === "destinations" ? startCounter : 0,
      events: stream === "events" ? startCounter : 0,
      shops: stream === "shops" ? startCounter : 0,
      world: stream === "world" ? startCounter : 0,
    },
  };
  return () => {
    const draw = nextRunRngValue(state, stream);
    state.counters[stream] = draw.nextCounter;
    return draw.value;
  };
}

export const placeholderRng: Rng = () => 0;

export function rollChance(probability: number, rng: Rng): boolean {
  if (Number.isNaN(probability)) throw new Error("rollChance requires a number");
  if (probability <= 0) return false;
  if (probability >= 1) return true;
  return assertDraw(rng()) < probability;
}

export function rollPercent(chance: number, rng: Rng): boolean {
  if (Number.isNaN(chance)) throw new Error("rollPercent requires a number");
  return rollChance(chance / 100, rng);
}

export function getBattleRng(state: { rng?: Rng }): Rng {
  if (!state.rng) throw new Error("BattleState.rng is required for outcome rolls");
  return state.rng;
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = rngInt(rng, index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[index]!];
  }
  return shuffled;
}

export function sampleItems<T>(items: readonly T[], count: number, rng: Rng): T[] {
  if (!Number.isInteger(count) || count < 0) throw new Error("sampleItems requires a non-negative integer count");
  if (count === 0) return [];
  return shuffle(items, rng).slice(0, Math.min(count, items.length));
}

export function pickRandom<T>(items: readonly T[], rng: Rng): T | undefined {
  if (items.length === 0) return undefined;
  return items[rngInt(rng, items.length)];
}

export function takeRandomItem<T>(items: T[], rng: Rng): T | undefined {
  if (items.length === 0) return undefined;
  const index = rngInt(rng, items.length);
  const [removed] = items.splice(index, 1);
  return removed;
}

export function pickRandomUnsafe<T>(items: readonly T[]): T | undefined {
  return pickRandom(items, Math.random);
}
