import { runCareer } from "@/app/playthrough/career";
import { createCareerRuntime } from "@/app/playthrough/career-runtime";
import { createPlaythroughFixture } from "@/app/playthrough/fixtures";
import type { CareerConfig } from "@/app/playthrough/types";
import { createDefaultSaveData } from "@/features/alchemy/shared/storage";
import { readGameplayState } from "@/features/alchemy/shared/stores/gameplay-state-store";
import { registerSessionCleanup } from "@/features/alchemy/shared/stores/session-capabilities";
import { describe, expect, it, vi } from "vitest";

describe("career runtime ownership", () => {
  it("disposes the career session when its initial save cannot load", async () => {
    const initialSave = createDefaultSaveData();
    initialSave.saveSchemaVersion += 1;
    const runtime = createCareerRuntime(5);
    const cleanup = vi.fn();
    registerSessionCleanup(runtime.session, cleanup);
    try {
      await expect(
        runCareer(
          {
            seed: 5,
            hero: "knight",
            mode: "campaign",
            difficulty: "difficulty-1",
            runs: 1,
            horizon: 1,
            maxSteps: 10,
            maxTurns: 10,
            policy: "archetype",
            combatPolicy: "greedy-effective-damage",
            initialSave,
          },
          undefined,
          undefined,
          undefined,
          runtime,
        ),
      ).rejects.toThrow("Initial save invalid");
      expect(cleanup).toHaveBeenCalledOnce();
      expect(() => readGameplayState(runtime.session)).toThrow(/disposed/);
    } finally {
      await runtime.session.dispose();
    }
  });
  it("reproduces sequential careers when two production careers interleave in one process", async () => {
    const application = readGameplayState();
    const originalNow = Date.now;
    const originalUUID = globalThis.crypto.randomUUID;
    const base: CareerConfig = {
      seed: 5,
      hero: "knight",
      mode: "labyrinth",
      difficulty: "difficulty-1",
      runs: 1,
      horizon: 3,
      maxSteps: 1000,
      maxTurns: 100,
      policy: "archetype",
      combatPolicy: "greedy-effective-damage",
      initialSave: createPlaythroughFixture("economy-v1"),
    };
    const other: CareerConfig = { ...base, seed: 8, mode: "wildwood", resumeAt: 7 };
    const expected = [await runCareer(base), await runCareer(other)];
    const concurrent = await Promise.all([runCareer(base), runCareer(other)]);
    for (const [index, career] of concurrent.entries()) {
      expect(career.status, career.error).toBe("completed");
      expect(expected[index]!.status, expected[index]!.error).toBe("completed");
      expect(career.finalSave).toEqual(expected[index]!.finalSave);
      expect(career.journal).toEqual(expected[index]!.journal);
      expect(career.outcomes).toEqual(expected[index]!.outcomes);
    }
    expect(readGameplayState()).toBe(application);
    expect(Date.now).toBe(originalNow);
    expect(globalThis.crypto.randomUUID).toBe(originalUUID);
  });
});
