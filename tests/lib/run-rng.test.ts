import { beforeEach, describe, expect, it } from "vitest";
import { createRunRngState, nextRunRngValue } from "@/lib/run-rng";
import { createRunRandomSource, restoreRun, snapshotRun } from "@/features/alchemy/shared/stores/run-session-facade";
import { resetRunDomainStore } from "@/features/alchemy/shared/stores/run-domain-store";
import { setRunProgress } from "../helpers/run-domain-store-test";

function drawSequence(seed: number, stream: "rewards" | "destinations", count: number): number[] {
  const state = createRunRngState(() => seed / 0x1_0000_0000);
  const values: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const draw = nextRunRngValue(state, stream);
    state.counters[stream] = draw.nextCounter;
    values.push(draw.value);
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
    const state = createRunRngState(() => 987654 / 0x1_0000_0000);
    for (let index = 0; index < 2; index += 1) {
      const draw = nextRunRngValue(state, "rewards");
      state.counters.rewards = draw.nextCounter;
    }

    const actual: number[] = [];
    for (let index = 0; index < 3; index += 1) {
      const draw = nextRunRngValue(state, "destinations");
      state.counters.destinations = draw.nextCounter;
      actual.push(draw.value);
    }
    expect(actual).toEqual(baseline);
  });

  it("continues the exact sequence after snapshot and restore", () => {
    setRunProgress({ rng: createRunRngState(() => 42 / 0x1_0000_0000) });
    const rewards = createRunRandomSource("rewards");
    rewards();
    const snapshot = snapshotRun("destination");
    const expectedNext = rewards();

    restoreRun(snapshot, {}, {});

    expect(createRunRandomSource("rewards")()).toBe(expectedNext);
  });
});
