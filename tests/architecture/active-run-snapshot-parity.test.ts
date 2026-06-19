import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");

function read(relPath: string): string {
  return readFileSync(join(ROOT, relPath), "utf8");
}

function extractActiveRunDataKeys(typeSource: string): string[] {
  const match = typeSource.match(/export type ActiveRunData = \{([\s\S]*?)\n\};/);
  expect(match).not.toBeNull();
  const body = match![1];
  return [...body.matchAll(/^\s+(\w+):/gm)].map((m) => m[1]);
}

describe("active run snapshot parity", () => {
  const typeKeys = extractActiveRunDataKeys(read("src/lib/active-run-session/types.ts"));
  const snapshotSource = read("src/lib/active-run-session/snapshot.ts");
  const restoreSource = read("src/features/alchemy/shared/stores/run-transitions.ts");

  it("serializes every ActiveRunData field in createActiveRunSnapshot", () => {
    for (const key of typeKeys) {
      const hasField =
        snapshotSource.includes(`${key}:`) || snapshotSource.includes(`${key},`) || snapshotSource.includes(`${key} =`);
      expect(hasField).toBe(true);
    }
  });

  const progressViaInitialize = ["store.initialize(activeRun"];
  const restoreFieldSignals: Record<string, string[]> = {
    characterId: progressViaInitialize,
    runDeck: progressViaInitialize,
    runGold: progressViaInitialize,
    runPlayerHealth: progressViaInitialize,
    runMaxHealth: progressViaInitialize,
    roomsEncountered: progressViaInitialize,
    currentAct: progressViaInitialize,
    destinationIndexInAct: progressViaInitialize,
    completedDestinations: progressViaInitialize,
    lastOfferedDestinations: progressViaInitialize,
    destinationRoundsSinceOffered: progressViaInitialize,
    runTrinkets: progressViaInitialize,
    encounteredRunEnemyIds: progressViaInitialize,
    selectedDifficulty: progressViaInitialize,
    contentSystemType: progressViaInitialize,
    currentScreen: ["activeRun?.currentScreen", "activeRun.currentScreen"],
    labyrinthMap: ["activeRun.labyrinthMap"],
    labyrinthPendingNode: ["activeRun.labyrinthPendingNode"],
    activeCombat: ["activeRun.activeCombat", "activeRun?.activeCombat"],
    destinationChoices: ["activeRun.destinationChoices"],
    wildwoodDraft: ["activeRun.wildwoodDraft"],
    runTalentXP: progressViaInitialize,
    runMaterialsEarned: progressViaInitialize,
    pendingReward: ["activeRun.pendingReward"],
  };

  it("restoreRun references persisted ActiveRunData fields", () => {
    for (const key of typeKeys) {
      const signals = restoreFieldSignals[key] ?? [`activeRun.${key}`, `activeRun?.${key}`];
      expect(signals.some((signal) => restoreSource.includes(signal))).toBe(true);
    }
  });
});
