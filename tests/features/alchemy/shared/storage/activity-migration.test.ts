import { afterEach, expect, it, vi } from "vitest";
import { createGameSession } from "@/features/alchemy/shared/stores/game-session";
import { readGameplayState } from "@/features/alchemy/shared/stores/gameplay-state-store";
import { createSessionPersistence, evaluateSaveCandidates } from "@/features/alchemy/shared/storage";
import { defaultBattleState, battleSnapshot } from "@/lib/battle";
import { createRunRngState } from "@/lib/rng";
import { emptyInventory } from "@/lib/homestead/inventory";
import { saveEnvelopeFixture } from "../../../../fixtures/saves";
import { makeMinimalActiveRunInput } from "../../../../fixtures/active-run";
import { version19MysterySave } from "../../../../fixtures/current-saves";
import * as materials from "@/features/alchemy/shared/stores/run-session-write-port";

const sessions: Array<ReturnType<typeof createGameSession>> = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const session of sessions.splice(0)) await session.dispose();
});
function legacyRun(overrides: Record<string, unknown> = {}) {
  const run = makeMinimalActiveRunInput({
    rng: createRunRngState(42),
    runTalentXP: { block: 3 },
    runMaterialsEarned: { ...emptyInventory(), wood: 2 },
    ...overrides,
  });
  delete run.activity;
  return run;
}
function legacySave(run: Record<string, unknown>, savedAt = 100) {
  return {
    ...saveEnvelopeFixture(),
    saveSchemaVersion: 20,
    lastSavedAt: savedAt,
    gold: 7,
    talentXP: { block: 10 },
    materialInventory: { ...emptyInventory(), wood: 2 },
    activeRun: run,
  };
}
it("migrates supported Mystery and fixed shop offers without consuming random streams", () => {
  const older = evaluateSaveCandidates([JSON.stringify(version19MysterySave())]);
  expect(older.data.saveSchemaVersion).toBe(21);
  expect(older.data.activeRun?.activity.kind).toBe("mystery");
  const rng = createRunRngState(42);
  const loaded = evaluateSaveCandidates([
    JSON.stringify(
      legacySave(
        legacyRun({
          rng,
          currentScreen: "shop",
          shopState: { cards: [], refreshesLeft: 2, purchasedSlotKeys: ["slot:1"], removeUsed: true },
        }),
      ),
    ),
  ]);
  expect(loaded.status.kind).toBe("ok");
  expect(loaded.data.activeRun?.rng).toEqual(rng);
  expect(loaded.data.activeRun?.activity).toMatchObject({ kind: "shop", data: { refreshesLeft: 2, removeUsed: true } });
  for (const field of ["currentScreen", "activeCombat", "interruptedFlow", "shopState"])
    expect(loaded.data.activeRun).not.toHaveProperty(field);
});
it("preserves stranded Gold/material rewards and consumes a Companion handoff only as data", () => {
  const pending = {
    rewardType: "card",
    choiceIds: [],
    companionChoiceIds: ["wolf-companion"],
    selectedId: null,
    gold: 7,
    materials: { ...emptyInventory(), wood: 3 },
    destinations: [],
    selectedBossId: null,
    lastVictoryEnemyType: "normal",
    lastVictoryContentSystem: "campaign",
  };
  const load = (kind: string) =>
    evaluateSaveCandidates([
      JSON.stringify(legacySave(legacyRun({ currentScreen: "destination", interruptedFlow: { kind, pending } }))),
    ]);
  expect(load("primary-reward").data.activeRun?.activity).toMatchObject({
    kind: "rewards",
    data: { gold: 7, materials: { wood: 3 }, companionChoiceIds: ["wolf-companion"] },
  });
  expect(load("companion-reward").data.activeRun?.activity).toMatchObject({
    kind: "rewards",
    data: { gold: 0, materials: emptyInventory(), choiceIds: ["wolf-companion"], companionChoiceIds: [] },
  });
});
it("abandons only the selected legacy run with current settlement and an acknowledged terminal save", async () => {
  const state = battleSnapshot({
    ...defaultBattleState(),
    gold: 7,
    playerHealth: 20,
    enemyHealth: 12,
    turnPhase: "enemy",
  });
  const incompatible = legacySave(
    legacyRun({ activeCombat: { battleState: state, pendingBattleTransition: { kind: "continue-end-turn" } } }),
  );
  const compatible = legacySave(legacyRun({ currentScreen: "destination" }), 200);
  expect(
    evaluateSaveCandidates([JSON.stringify(incompatible), JSON.stringify(compatible)]).restoreActions,
  ).toBeUndefined();
  const loaded = evaluateSaveCandidates([JSON.stringify(incompatible)]);
  expect(loaded.restoreActions).toEqual(["abandon-active-run"]);
  const session = createGameSession();
  sessions.push(session);
  const persistence = createSessionPersistence(session);
  let written = "";
  persistence.configure({
    readCandidates: async () => ({ ok: true, candidates: [] }),
    write: async (_key, value) => {
      written = value;
      return { ok: true };
    },
    writeSync: (_key, value) => {
      written = value;
      return { ok: true };
    },
    clear: async () => ({ ok: true }),
  });
  expect(persistence.restore(loaded.data, { restoreActions: loaded.restoreActions })).toBe(true);
  await persistence.waitForWrites();
  const root = readGameplayState(session);
  expect(root.session.activity.kind).toBe("inactive");
  expect(root.run.navigation.screen).toBe("game-over");
  expect(root.session.runRecap?.ending).toBe("abandoned");
  expect(root.runProfile.talentXP.block).toBe(13);
  expect(root.runProfile.materialInventory.wood).toBe(2);
  expect(root.runProfile.gold).toBe(7);
  expect(root.run.activeRun.rng).toEqual(loaded.data.activeRun?.rng);
  expect(JSON.parse(written)).toMatchObject({ saveSchemaVersion: 21, activeRun: null, talentXP: { block: 13 } });
  const before = readGameplayState(session);
  expect(
    persistence.restore(loaded.data, { restoreActions: loaded.restoreActions, preserveActiveRunIfInitialized: true }),
  ).toBe(false);
  expect(readGameplayState(session).session).toBe(before.session);
});
it("does not retire committed terminal battles or partially publish a failed settlement", () => {
  const terminal = evaluateSaveCandidates([
    JSON.stringify(
      legacySave(
        legacyRun({ activeCombat: { battleState: { ...defaultBattleState(), enemyHealth: 0, turnPhase: "enemy" } } }),
      ),
    ),
  ]);
  expect(terminal.restoreActions).toBeUndefined();
  expect(terminal.data.activeRun?.activity.kind).toBe("battle");
  const loaded = evaluateSaveCandidates([
    JSON.stringify(
      legacySave(
        legacyRun({
          activeCombat: {
            battleState: { ...defaultBattleState(), playerHealth: 20, enemyHealth: 12, turnPhase: "enemy" },
          },
        }),
      ),
    ),
  ]);
  const session = createGameSession();
  sessions.push(session);
  vi.spyOn(materials, "awardRunEndMaterials").mockImplementationOnce(() => {
    throw new Error("settlement failed");
  });
  expect(() =>
    createSessionPersistence(session).restore(loaded.data, { restoreActions: loaded.restoreActions }),
  ).toThrow("settlement failed");
  const root = readGameplayState(session);
  expect(root.session.activity.kind).toBe("inactive");
  expect(root.run.initialized).toBe(false);
  expect(root.runProfile.talentXP.block).toBe(10);
});

it("retires a legacy Wildwood battle preparation without losing the run's earned progress", () => {
  const loaded = evaluateSaveCandidates([
    JSON.stringify(
      legacySave(
        legacyRun({
          contentSystemType: "wildwood",
          wildwoodDraft: {
            phase: "battle",
            draftChoices: [],
            remainingBossIds: [],
            previousBossId: null,
            currentBossId: null,
            currentCombatTraitIds: [],
            currentRewardTraitIds: [],
          },
        }),
      ),
    ),
  ]);
  expect(loaded.data.activeRun).not.toBeNull();
  expect(loaded.restoreActions).toEqual(["abandon-active-run"]);
  expect(loaded.data.activeRun?.runTalentXP).toEqual({ block: 3 });
  expect(loaded.data.activeRun?.rng).toEqual(createRunRngState(42));
});

it.each(["campfire", "transmutation", "shop", "alchemist", "trinket-shop", "equipment-shop"])(
  "preserves version 20's missing optional %s visit through current defaults",
  (kind) => {
    const rng = createRunRngState(42);
    const loaded = evaluateSaveCandidates([JSON.stringify(legacySave(legacyRun({ currentScreen: kind, rng })))]);
    expect(loaded.data.activeRun?.activity.kind).toBe(kind);
    expect(loaded.data.activeRun?.rng).toEqual(rng);
    expect(loaded.data.activeRun?.runTalentXP).toEqual({ block: 3 });
    expect(loaded.restoreActions).toBeUndefined();
  },
);
