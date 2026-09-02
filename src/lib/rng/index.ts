export type Rng = () => number;

const UINT32_RANGE = 0x1_0000_0000;

const STREAM_SALTS: Record<RunRngStream, number> = {
  rewards: 0x9e37_79b9,
  destinations: 0x243f_6a88,
  events: 0xb7e1_5163,
  shops: 0x94d0_49bb,
  world: 0xdead_beef,
};

export type RunRngStream = "rewards" | "destinations" | "events" | "shops" | "world";

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

export function createSeededRng(seed: number): Rng {
  let s = toUint32(seed);
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / UINT32_RANGE;
  };
}

export function createRunRngState(rng: Rng = Math.random): RunRngState {
  const raw = rng();
  const seed = Number.isFinite(raw) ? toUint32(Math.trunc(raw * UINT32_RANGE)) : 0;
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
    if (import.meta.env.DEV) throw new Error(`Unknown run RNG stream: ${stream}`);
    return { value: 0, nextCounter: counter + 1 };
  }
  const value = mixUint32(state.seed ^ STREAM_SALTS[stream] ^ Math.imul(counter + 1, 0x85eb_ca6b)) / UINT32_RANGE;
  return { value, nextCounter: counter + 1 };
}

export function rngInt(rng: Rng, n: number): number {
  return Math.floor(rng() * n);
}

export function createRunStreamRng(seed: number, stream: RunRngStream = "world", startCounter = 0): Rng {
  const state: RunRngState = {
    seed: toUint32(seed),
    counters: {
      rewards: 0,
      destinations: 0,
      events: 0,
      shops: 0,
      world: 0,
      [stream]: startCounter,
    },
  };
  return () => {
    const draw = nextRunRngValue(state, stream);
    state.counters[stream] = draw.nextCounter;
    return draw.value;
  };
}

export const placeholderRng: Rng = () => 0;

export function rollPercent(chance: number, rng: Rng): boolean {
  return chance > 0 && rng() * 100 < chance;
}

export function rollChance(probability: number, rng: Rng): boolean {
  return probability > 0 && rng() < probability;
}

export function getBattleRng(state: { rng?: Rng }): Rng {
  if (!state.rng) throw new Error("BattleState.rng is required for outcome rolls");
  return state.rng;
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.min(index, Math.floor(rng() * (index + 1)));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex]!, shuffled[index]!];
  }
  return shuffled;
}

export function sampleItems<T>(items: readonly T[], count: number, rng: Rng): T[] {
  return shuffle(items, rng).slice(0, Math.min(count, items.length));
}

export function pickRandom<T>(items: readonly T[], rng: Rng): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
}

export function takeRandomItem<T>(items: T[], rng: Rng): T | undefined {
  if (items.length === 0) return undefined;
  const index = Math.min(items.length - 1, Math.floor(rng() * items.length));
  const [removed] = items.splice(index, 1);
  return removed;
}

export function shuffleUnsafe<T>(items: readonly T[]): T[] {
  return shuffle(items, Math.random);
}

export function pickRandomUnsafe<T>(items: readonly T[]): T | undefined {
  return pickRandom(items, Math.random);
}

export function takeRandomItemUnsafe<T>(items: T[]): T | undefined {
  return takeRandomItem(items, Math.random);
}
