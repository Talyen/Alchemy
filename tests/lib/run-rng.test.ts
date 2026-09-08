import { beforeEach, describe, expect, it } from "vitest";
import { createRunRngState, createRunStreamRng, nextRunRngValue, stepRunRng } from "@/lib/rng";
import { createDraftRunRandomSource } from "@/features/alchemy/shared/stores/run-session-write-port";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { restoreRun, snapshotRun } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import { resetRunDomainStore } from "../helpers/gameplay-store-test";
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

  it("replays the same stream from the same seed and counter", () => {
    expect(drawSequence(123456, "rewards", 5)).toEqual(drawSequence(123456, "rewards", 5));
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

  it("stepRunRng advances counters and matches nextRunRngValue", () => {
    const state1 = createRunRngState(42);
    const state2 = createRunRngState(42);
    const peek = nextRunRngValue(state1, "rewards");
    const stepped = stepRunRng(state2, "rewards");
    expect(stepped).toBe(peek.value);
    expect(state2.counters.rewards).toBe(peek.nextCounter);
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

  it("createRunStreamRng matches nextRunRngValue for the same seed and stream", () => {
    const stream = createRunStreamRng(123456, "world");
    const state = createRunRngState(123456);
    const expected: number[] = [];
    for (let index = 0; index < 5; index += 1) {
      expected.push(stepRunRng(state, "world"));
    }
    expect([stream(), stream(), stream(), stream(), stream()]).toEqual(expected);
  });

  it("supports numeric seeds and defaults to Math.random", () => {
    const fromNum = createRunRngState(123456);
    expect(fromNum.seed).toBe(123456);

    const fromDefault = createRunRngState();
    expect(fromDefault.seed).toBeGreaterThanOrEqual(0);
    expect(fromDefault.seed).toBeLessThanOrEqual(0xffff_ffff);

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
    // @ts-expect-error — force unknown stream for guard branch
    expect(() => nextRunRngValue(state, "unknown")).toThrow(/Unknown run RNG stream/);
    // @ts-expect-error — force unknown stream for guard branch
    expect(() => createRunStreamRng(42, "unknown")).toThrow(/Unknown run RNG stream/);
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
});
