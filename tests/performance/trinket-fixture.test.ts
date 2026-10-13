import { expect, it } from "vitest";
import { snapshotCareer } from "@/app/playthrough/career";
import { createCareerRuntime } from "@/app/playthrough/career-runtime";
import { createPlaythroughController } from "@/app/playthrough/controller";
import { createPlaythroughFixture } from "@/app/playthrough/fixtures";
import { restoreSessionSave } from "@/features/alchemy/shared/stores/run-lifecycle";
import { readBattle } from "@/features/alchemy/shared/stores/run-reads";

it("the trinket fixture starts real combat with Collar active and retains inspectable Oathkeeper", async () => {
  const { session } = createCareerRuntime(1);
  try {
    restoreSessionSave(createPlaythroughFixture("trinket-v1", session), session);
    const { flow } = createPlaythroughController(session);
    flow.goToScreen("game-mode-select");
    flow.beginCampaign();
    flow.handleCharacterSelect("knight");
    flow.handleDifficultySelect("difficulty-1");
    const battle = readBattle(session);
    expect(battle.hasActiveBattle).toBe(true);
    expect(battle.battleState.trinketEffects.companionDamageBonus).toBeGreaterThan(0);
    const saved = snapshotCareer(session);
    expect(saved.activeRun?.activity).toMatchObject({
      kind: "battle",
      data: {
        battleState: {
          trinketEffects: { companionDamageBonus: battle.battleState.trinketEffects.companionDamageBonus },
        },
      },
    });
    expect(saved.equippedTrinkets.knight).toBe("companions-collar");
    expect(saved.discoveredUniqueIds).toContain("oathkeeper");
    expect(saved.gearInventories.knight.some((item) => item.definitionId === "oathkeeper")).toBe(true);
  } finally {
    await session.dispose();
  }
});
