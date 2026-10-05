import type { UnstampedSaveData } from "@/features/alchemy/shared/storage";
import { createGameSession } from "@/features/alchemy/shared/stores/game-session";

export interface CareerRuntimeInputs {
  idCounter: number;
  clock: number;
  policyVersion: 1;
}

/** Recorded inputs are local to a career; replay never replaces process globals. */
export function createCareerRuntime(seed: number, initialSave?: UnstampedSaveData, inputs?: CareerRuntimeInputs) {
  let runSeed = seed;
  let id = inputs?.idCounter ?? 0;
  if (!inputs && initialSave) {
    for (const match of JSON.stringify(initialSave).matchAll(/00000000-0000-4000-8000-([0-9a-f]{12})/g))
      id = Math.max(id, Number.parseInt(match[1]!, 16));
  }
  const now = inputs?.clock ?? 1_800_000_000_000;
  const session = createGameSession({
    runtimeInputs: {
      generateRunSeed: () => runSeed >>> 0,
      createInstanceId: () => `00000000-0000-4000-8000-${(++id).toString(16).padStart(12, "0")}`,
      clock: {
        now: () => now,
        setTimeout: (callback, delay) => globalThis.setTimeout(callback, delay),
        clearTimeout: (timer) => globalThis.clearTimeout(timer),
      },
    },
  });
  return {
    session,
    setRunSeed(value: number) {
      runSeed = value;
    },
    snapshot(): CareerRuntimeInputs {
      return { idCounter: id, clock: now, policyVersion: 1 };
    },
  };
}

export type CareerRuntime = ReturnType<typeof createCareerRuntime>;
