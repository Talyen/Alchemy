import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");

function read(relPath: string): string {
  return readFileSync(join(ROOT, relPath), "utf8");
}

function extractActiveRunDataKeys(typeSource: string): string[] {
  const match = typeSource.match(/(?:export (?:type|interface) ActiveRunData) (?:= )?\{([\s\S]*?)\n\};?/);
  expect(match).not.toBeNull();
  const body = match![1];
  return [...body.matchAll(/^\s+(\w+):/gm)].map((m) => m[1]);
}

describe("active run snapshot parity", () => {
  const typeKeys = extractActiveRunDataKeys(read("src/lib/active-run-session/types.ts"));
  const restoreSource = [
    read("src/features/alchemy/shared/stores/run-transitions.ts"),
    read("src/features/alchemy/shared/stores/restore-active-run-session.ts"),
    read("src/features/alchemy/shared/stores/run-resume-codec.ts"),
  ].join("\n");

  it("keeps snapshot and resume translation behind one feature-owned codec", () => {
    const codecSource = read("src/features/alchemy/shared/stores/run-resume-codec.ts");
    expect(codecSource).toContain("export function encodeRunResumeSnapshot");
    expect(codecSource).toContain("export function decodeRunResumeSnapshot");
    expect(codecSource).toContain("...progress");
    expect(read("src/features/alchemy/shared/stores/run-transitions.ts")).toContain("encodeRunResumeSnapshot");
    expect(read("src/features/alchemy/shared/stores/run-transitions.ts")).toContain("decodeRunResumeSnapshot");
  });

  const progressViaInitialize = ["actions.runActions.initializeFromResumeSnapshot(decoded.progress"];
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
    rng: progressViaInitialize,
    currentScreen: ["activeRun?.currentScreen", "activeRun.currentScreen"],
    labyrinthMap: ["activeRun.labyrinthMap"],
    labyrinthPendingNode: ["activeRun.labyrinthPendingNode"],
    activeCombat: ["activeRun.activeCombat", "activeRun?.activeCombat"],
    interruptedFlow: ["activeRun.interruptedFlow"],
    wildwoodDraft: ["activeRun.wildwoodDraft"],
    runTalentXP: progressViaInitialize,
    runMaterialsEarned: progressViaInitialize,
  };

  it("restoreRun references persisted ActiveRunData fields", () => {
    for (const key of typeKeys) {
      const signals = restoreFieldSignals[key] ?? [`activeRun.${key}`, `activeRun?.${key}`];
      expect(signals.some((signal) => restoreSource.includes(signal))).toBe(true);
    }
  });
});
