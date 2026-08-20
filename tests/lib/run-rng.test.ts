import { beforeEach, describe, expect, it } from "vitest";
import { createRunRngState, createRunStreamRng, nextRunRngValue } from "@/lib/run-rng";
import { createDraftRunRandomSource } from "@/features/alchemy/shared/stores/run-session-write-port";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { restoreRun, snapshotRun } from "@/features/alchemy/shared/stores/run-session-lifecycle-port";
import { resetRunDomainStore } from "../helpers/gameplay-store-test";
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
    const first = dispatchRunSessionCommand((draft) => createDraftRunRandomSource(draft, "rewards")());
    const snapshot = snapshotRun("destination");
    const expectedNext = dispatchRunSessionCommand((draft) => createDraftRunRandomSource(draft, "rewards")());

    restoreRun(snapshot, {}, {});

    expect(dispatchRunSessionCommand((draft) => createDraftRunRandomSource(draft, "rewards")())).toBe(expectedNext);
    expect(first).not.toBe(expectedNext);
  });

  it("createRunStreamRng matches nextRunRngValue for the same seed and stream", () => {
    const stream = createRunStreamRng(123456, "world");
    const state = createRunRngState(() => 123456 / 0x1_0000_0000);
    state.seed = 123456 >>> 0;
    const expected: number[] = [];
    for (let index = 0; index < 5; index += 1) {
      const draw = nextRunRngValue(state, "world");
      state.counters.world = draw.nextCounter;
      expected.push(draw.value);
    }
    expect([stream(), stream(), stream(), stream(), stream()]).toEqual(expected);
  });
});
