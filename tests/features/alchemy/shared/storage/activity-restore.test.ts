import { createSaveBackend } from "../../../../helpers/save-backend";
import { afterEach, expect, it, vi } from "vitest";
import { createGameSession } from "@/features/alchemy/shared/stores/game-session";
import { readGameplayState } from "@/features/alchemy/shared/stores/gameplay-state-reads";
import { createSessionPersistence, evaluateSaveCandidates } from "@/features/alchemy/shared/storage";
import { defaultBattleState, battleSnapshot, type BattleSnapshot } from "@/lib/battle";
import { createRunRngState } from "@/lib/rng";
import { emptyInventory } from "@/lib/homestead/inventory";
import { CURRENT_SAVE_SCHEMA_VERSION } from "@/lib/validation";
import { saveEnvelopeFixture } from "../../../../fixtures/saves";
import { makeMinimalActiveRunInput } from "../../../../fixtures/active-run";
import * as settlement from "@/features/alchemy/shared/stores/write/run-end";

const sessions: Array<ReturnType<typeof createGameSession>> = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const session of sessions.splice(0)) await session.dispose();
});

function battleSave(overrides: Partial<BattleSnapshot> = {}, lastSavedAt = 100) {
  return saveEnvelopeFixture({
    lastSavedAt,
    gold: 7,
    talentXP: { block: 10 },
    materialInventory: { ...emptyInventory(), wood: 2 },
    activeRun: makeMinimalActiveRunInput({
      rng: createRunRngState(42),
      runTalentXP: { block: 3 },
      runMaterialsEarned: { ...emptyInventory(), wood: 2 },
      activity: {
        kind: "battle",
        data: {
          battleState: battleSnapshot({
            ...defaultBattleState(),
            gold: 7,
            playerHealth: 20,
            enemyHealth: 12,
            turnPhase: "enemy",
            ...overrides,
          }),
        },
      },
    }),
  });
}

it("abandons only the selected unfinished turn with atomic settlement and an acknowledged terminal save", async () => {
  const incompatible = battleSave();
  const compatible = battleSave({ turnPhase: "player" }, 200);
  expect(
    evaluateSaveCandidates([JSON.stringify(incompatible), JSON.stringify(compatible)]).restoreActions,
  ).toBeUndefined();
  const loaded = evaluateSaveCandidates([JSON.stringify(incompatible)]);
  expect(loaded.restoreActions).toEqual(["abandon-active-run"]);
  const session = createGameSession();
  sessions.push(session);
  const persistence = createSessionPersistence(session);
  let written = "";
  persistence.configure(
    createSaveBackend({
      write: async (_key, value) => {
        written = value;
        return { ok: true };
      },
      writeSync: (_key, value) => {
        written = value;
        return { ok: true };
      },
    }),
  );
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
  expect(JSON.parse(written)).toMatchObject({
    saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    activeRun: null,
    talentXP: { block: 13 },
  });
  const before = readGameplayState(session);
  expect(
    persistence.restore(loaded.data, { restoreActions: loaded.restoreActions, preserveActiveRunIfInitialized: true }),
  ).toBe(false);
  expect(readGameplayState(session).session).toBe(before.session);
});

it("resumes a committed terminal battle even when its phase is enemy", () => {
  const terminal = evaluateSaveCandidates([JSON.stringify(battleSave({ enemyHealth: 0 }))]);
  expect(terminal.restoreActions).toBeUndefined();
  expect(terminal.data.activeRun?.activity).toMatchObject({
    kind: "battle",
    data: { battleState: { enemyHealth: 0 } },
  });
});

it("rolls back the complete restore when incompatible battle settlement fails", () => {
  const loaded = evaluateSaveCandidates([JSON.stringify(battleSave())]);
  const session = createGameSession();
  sessions.push(session);
  const before = readGameplayState(session);
  vi.spyOn(settlement, "settleRunEnd").mockImplementationOnce(() => {
    throw new Error("settlement failed");
  });
  expect(() =>
    createSessionPersistence(session).restore(loaded.data, { restoreActions: loaded.restoreActions }),
  ).toThrow("settlement failed");
  expect(readGameplayState(session)).toBe(before);
});
