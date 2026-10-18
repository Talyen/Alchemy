import { describe, expect, it } from "vitest";
import { createRunRngState, createRunStateRng, createRunStreamRng, stepRunRng } from "@/lib/rng";

function drawSequence(seed: number, stream: "rewards" | "destinations", count: number): number[] {
  const state = createRunRngState(seed);
  const values: number[] = [];
  for (let index = 0; index < count; index += 1) {
    values.push(stepRunRng(state, stream));
  }
  return values;
}

describe("run RNG", () => {
  it("advancing one named stream does not perturb another", () => {
    const baseline = drawSequence(987654, "destinations", 3);
    const state = createRunRngState(987654);
    for (let index = 0; index < 2; index += 1) {
      stepRunRng(state, "rewards");
    }

    const actual: number[] = [];
    for (let index = 0; index < 3; index += 1) {
      actual.push(stepRunRng(state, "destinations"));
    }
    expect(actual).toEqual(baseline);
  });

  it("pins the saved rewards sequence for seed 123456", () => {
    expect(drawSequence(123456, "rewards", 5)).toEqual([
      0.083078344585374, 0.6497560180723667, 0.965069661848247, 0.0027175310533493757, 0.5301487483084202,
    ]);
  });

  it("keeps every RNG adapter on the same sequence", () => {
    const state = createRunRngState(123456);
    const boundState = createRunRngState(123456);
    state.counters.rewards = 17;
    boundState.counters.rewards = 17;
    const bound = createRunStateRng(boundState, "rewards");
    const standalone = createRunStreamRng(state.seed, "rewards", 17);

    for (let index = 0; index < 3; index += 1) {
      const stepped = stepRunRng(state, "rewards");
      expect(bound()).toBe(stepped);
      expect(standalone()).toBe(stepped);
      expect(boundState.counters).toEqual(state.counters);
    }
  });

  it("requires a finite seed", () => {
    expect(createRunRngState(123456).seed).toBe(123456);
    expect(createRunRngState(123.9).seed).toBe(123);
    for (const seed of [NaN, Infinity, -Infinity]) {
      expect(() => createRunRngState(seed)).toThrow(/finite seed/);
    }
  });

  it("throws on unknown stream without advancing counters", () => {
    const state = createRunRngState(7);
    for (const stream of ["unknown", "toString", "__proto__"] as const) {
      // @ts-expect-error — force unknown stream for guard branch
      expect(() => stepRunRng(state, stream)).toThrow(/Unknown run RNG stream/);
      // @ts-expect-error — force unknown stream for guard branch
      expect(() => createRunStateRng(state, stream)()).toThrow(/Unknown run RNG stream/);
      // @ts-expect-error — force unknown stream for guard branch
      expect(() => createRunStreamRng(42, stream)).toThrow(/Unknown run RNG stream/);
    }
    expect(state.counters).toEqual({ rewards: 0, destinations: 0, events: 0, shops: 0, world: 0 });
  });

  it("rejects a non-integer startCounter", () => {
    expect(() => createRunStreamRng(7, "world", 0.5)).toThrow();
    expect(() => createRunStreamRng(7, "world", -1)).toThrow();
  });

  it("keeps the persisted and standalone RNG advancing at the safe counter boundary", () => {
    const state = createRunRngState(7);
    state.counters.world = Number.MAX_SAFE_INTEGER;
    const rng = createRunStateRng(state, "world");
    const standalone = createRunStreamRng(7, "world", Number.MAX_SAFE_INTEGER);
    const draws = [rng(), rng(), rng()];
    expect(new Set(draws).size).toBe(3);
    expect([standalone(), standalone(), standalone()]).toEqual(draws);
    const resumed = createRunStateRng(JSON.parse(JSON.stringify(state)), "world");
    expect(resumed()).toBe(rng());
  });
});
