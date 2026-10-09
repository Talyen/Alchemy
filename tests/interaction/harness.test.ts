import { describe, expect, it } from "vitest";
import { exercise, InteractionFailure, reduceActions, requireProgress, sequenceSeeds, type Scenario } from "./sequence";

describe("interaction discovery harness", () => {
  it("replays the same actions and observations and detects work stranded after completion", async () => {
    const create = (): Scenario => {
      let pending = false;
      return {
        fixture: { pending: false },
        actions: () => ["start", "finish", "stale"],
        run(action) {
          if (action === "start") pending = true;
          if (action === "finish") pending = false;
          if (action === "stale") pending = true;
        },
        settle() {
          requireProgress(!pending, "stranded-work", { pending });
        },
        check() {},
        observe: () => ({ pending }),
        dispose() {},
      };
    };
    const successful = ["start", "finish"];
    expect(await exercise(create, 4, 40, successful)).toEqual(await exercise(create, 77, 40, successful));
    await expect(exercise(create, 4, 40, ["start"])).rejects.toMatchObject({
      invariant: "stranded-work",
      sequence: { actions: ["start"] },
    });
    await expect(exercise(create, 4, 40, ["start", "finish", "stale"])).rejects.toMatchObject({
      invariant: "stranded-work",
    });
  });
  it("reduces a trace only while the same defect reproduces", async () => {
    const reproduces = async (actions: string[]) =>
      actions.indexOf("start") >= 0 && actions.indexOf("stale") > actions.indexOf("start");
    const reduced = await reduceActions(["noise", "start", "noise", "stale", "noise"], reproduces);
    expect(reduced).toEqual(["start", "stale"]);
    requireProgress(await reproduces(reduced), "reduction-preserves-failure", reduced);
  });
  it("keeps push seeds out of the deterministic daily nightly manifest", () => {
    const push = sequenceSeeds("push", "2026-10-09");
    const nightly = sequenceSeeds("nightly", "2026-10-09");
    expect(push).toHaveLength(16);
    expect(nightly).toHaveLength(128);
    expect(nightly).toEqual(sequenceSeeds("nightly", "2026-10-09"));
    expect(nightly.every((seed) => !push.includes(seed))).toBe(true);
    expect(nightly.slice(0, 64)).toEqual(sequenceSeeds("nightly", "2026-10-10").slice(0, 64));
    expect(nightly.slice(64)).not.toEqual(sequenceSeeds("nightly", "2026-10-10").slice(64));
  });
  it("does not treat an unavailable replay action as the original defect", async () => {
    const scenario: Scenario = {
      fixture: {},
      actions: () => [],
      run() {},
      check() {},
      settle() {},
      observe: () => ({}),
      dispose() {},
    };
    // An explicit replay cannot silently pass by stopping at an empty action set.
    await expect(exercise(() => scenario, 1, 1, ["stale"])).rejects.toBeInstanceOf(InteractionFailure);
  });
});

it("requires an explicit interaction owner for every registered route", async () => {
  const { ROUTE_SCREEN_VALUES } = await import("@/lib/routing");
  const { SCREEN_FAMILIES } = await import("./screen-coverage");
  expect(Object.keys(SCREEN_FAMILIES).sort()).toEqual([...ROUTE_SCREEN_VALUES].sort());
  for (const route of ROUTE_SCREEN_VALUES) expect(SCREEN_FAMILIES[route].length).toBeGreaterThan(0);
});
