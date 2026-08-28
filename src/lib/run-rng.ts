export type RunRngStream = "rewards" | "destinations" | "events" | "shops" | "world";

export interface RunRngState {
  seed: number;
  counters: Record<RunRngStream, number>;
}

const UINT32_RANGE = 0x1_0000_0000;

const STREAM_SALTS: Record<RunRngStream, number> = {
  rewards: 0x9e37_79b9,
  destinations: 0x243f_6a88,
  events: 0xb7e1_5163,
  shops: 0x94d0_49bb,
  world: 0xdead_beef,
};

function toUint32(value: number): number {
  return value >>> 0;
}

function mixUint32(value: number): number {
  let mixed = toUint32(value);
  mixed = Math.imul(mixed ^ (mixed >>> 16), 0x21f0_aaad);
  mixed = Math.imul(mixed ^ (mixed >>> 15), 0x735a_2d97);
  return toUint32(mixed ^ (mixed >>> 15));
}

export function createRunRngState(rng: () => number = Math.random): RunRngState {
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
    if (import.meta.env.DEV) throw new Error(`Unknown run RNG stream: ${String(stream)}`);
    return { value: 0, nextCounter: counter + 1 };
  }
  const value = mixUint32(state.seed ^ STREAM_SALTS[stream] ^ Math.imul(counter + 1, 0x85eb_ca6b)) / UINT32_RANGE;
  return { value, nextCounter: counter + 1 };
}

export function rngInt(rng: () => number, n: number): number {
  return Math.floor(rng() * n);
}

export function createRunStreamRng(seed: number, stream: RunRngStream = "world", startCounter = 0): () => number {
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
