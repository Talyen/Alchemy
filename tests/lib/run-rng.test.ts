import { beforeEach, describe, expect, it } from "vitest";
import { createRunRngState, createRunStateRng, createRunStreamRng, nextRunRngValue, stepRunRng } from "@/lib/rng";
import { createDraftRunRandomSource } from "@/features/alchemy/shared/stores/run-session-write-port";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { restoreRun, snapshotRun } from "@/features/alchemy/shared/stores/run-lifecycle";
import {
  createInitialActiveRunFields,
  generateRunSeed,
  setTestRunSeedOverride,
} from "@/features/alchemy/shared/stores/run-state-init";
import { resetRunDomainStore } from "../helpers/run-domain-store-test";
import { setRunProgress } from "../helpers/run-domain-store-test";

function drawSequence(seed: number, stream: "rewards" | "destinations", count: number): number[] {
  const state = createRunRngState(seed);
  const values: number[] = [];
  for (let index = 0; index < count; index += 1) {
    values.push(stepRunRng(state, stream));
  }
  return values;
}

describe("run RNG", () => {
  beforeEach(() => {
    resetRunDomainStore();
  });

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

  it.each([
    { stream: "rewards", values: [0.3151330079417676, 0.610154019901529, 0.09219017042778432] },
    { stream: "destinations", values: [0.06644266727380455, 0.4844358095433563, 0.6881019657012075] },
    { stream: "events", values: [0.2549680513329804, 0.12153172912076116, 0.11579785658977926] },
    { stream: "shops", values: [0.19091883092187345, 0.6437403073068708, 0.9986634401138872] },
    { stream: "world", values: [0.4205515377689153, 0.7797303574625403, 0.3962498402688652] },
  ] as const)("preserves the saved $stream sequence in every RNG adapter", ({ stream, values }) => {
    const state = createRunRngState(123456);
    const boundState = createRunRngState(123456);
    state.counters[stream] = 17;
    boundState.counters[stream] = 17;
    const bound = createRunStateRng(boundState, stream);
    const standalone = createRunStreamRng(state.seed, stream, 17);

    for (const [index, expected] of values.entries()) {
      const before = { ...state.counters };
      expect(nextRunRngValue(state, stream)).toEqual({ value: expected, nextCounter: 18 + index });
      expect(state.counters).toEqual(before);
      expect(stepRunRng(state, stream)).toBe(expected);
      expect(state.counters).toEqual({ ...before, [stream]: 18 + index });
      expect(bound()).toBe(expected);
      expect(boundState.counters).toEqual(state.counters);
      expect(standalone()).toBe(expected);
    }
  });

  it("continues the exact sequence after snapshot and restore", () => {
    setRunProgress({ rng: createRunRngState(42) });
    const first = dispatchRunSessionCommand((draft) => createDraftRunRandomSource(draft, "rewards")());
    const snapshot = snapshotRun("destination");
    const expectedNext = dispatchRunSessionCommand((draft) => createDraftRunRandomSource(draft, "rewards")());

    restoreRun(snapshot, {}, {});

    expect(dispatchRunSessionCommand((draft) => createDraftRunRandomSource(draft, "rewards")())).toBe(expectedNext);
    expect(first).not.toBe(expectedNext);
  });

  it("supports numeric and RNG seeds (callers pass Math.random explicitly)", () => {
    const fromNum = createRunRngState(123456);
    expect(fromNum.seed).toBe(123456);

    const fromRandom = createRunRngState(Math.random);
    expect(fromRandom.seed).toBeGreaterThanOrEqual(0);
    expect(fromRandom.seed).toBeLessThanOrEqual(0xffff_ffff);

    expect(createRunRngState(NaN).seed).toBe(0);
    expect(createRunRngState(Infinity).seed).toBe(0);
    expect(createRunRngState(-Infinity).seed).toBe(0);
  });

  it("falls back to seed 0 on non-finite rng output", () => {
    expect(createRunRngState(() => NaN).seed).toBe(0);
    expect(createRunRngState(() => Infinity).seed).toBe(0);
    expect(createRunRngState(() => -Infinity).seed).toBe(0);

    expect(createRunRngState(() => 0.5).seed).toBe(((0.5 * 0x1_0000_0000) | 0) >>> 0);
  });

  it("throws on unknown stream", () => {
    const state = createRunRngState(() => 0.1);
    for (const stream of ["unknown", "toString", "__proto__"] as const) {
      // @ts-expect-error — force unknown stream for guard branch
      expect(() => nextRunRngValue(state, stream)).toThrow(/Unknown run RNG stream/);
      // @ts-expect-error — force unknown stream for guard branch
      expect(() => stepRunRng(state, stream)).toThrow(/Unknown run RNG stream/);
      // @ts-expect-error — force unknown stream for guard branch
      expect(() => createRunStateRng(state, stream)()).toThrow(/Unknown run RNG stream/);
      // @ts-expect-error — force unknown stream for guard branch
      expect(() => createRunStreamRng(42, stream)).toThrow(/Unknown run RNG stream/);
    }
    expect(state.counters).toEqual({ rewards: 0, destinations: 0, events: 0, shops: 0, world: 0 });
  });

  it("pins the exact draw sequence for seed 123456", () => {
    expect(drawSequence(123456, "rewards", 5)).toEqual([
      0.083078344585374, 0.6497560180723667, 0.965069661848247, 0.0027175310533493757, 0.5301487483084202,
    ]);
  });

  it("maps out-of-range seed draws to seed 0", () => {
    expect(createRunRngState(() => 1).seed).toBe(0);
    expect(createRunRngState(() => -0.25).seed).toBe(0);
  });

  it("rejects a non-integer startCounter", () => {
    expect(() => createRunStreamRng(7, "world", 0.5)).toThrow();
    expect(() => createRunStreamRng(7, "world", -1)).toThrow();
  });

  it("seeds fresh runs deterministically under the test override", () => {
    setTestRunSeedOverride(777);
    try {
      expect(createInitialActiveRunFields(null).rng.seed).toBe(777);
      expect(createInitialActiveRunFields(null).rng.seed).toBe(777);
    } finally {
      setTestRunSeedOverride(null);
    }
  });

  it("generates uint32 seeds without an override", () => {
    setTestRunSeedOverride(null);
    for (const seed of [generateRunSeed(), generateRunSeed()]) {
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThanOrEqual(0xffff_ffff);
    }
  });
});
