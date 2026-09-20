import { createDefaultSaveData } from "@/features/alchemy/shared/storage";
import { hydrateAlchemyPersistenceFields } from "@/features/alchemy/shared/storage";
import { restoreRun } from "@/features/alchemy/shared/stores/run-lifecycle";
import { characters } from "@/lib/game-data";
import { ACTS_PER_RUN, DESTINATIONS_PER_ACT } from "@/lib/game-constants";
import type { CharacterId } from "@/lib/game-data";
import { createPlaythroughController } from "./controller";
import { snapshotCareer } from "./career";

/** Fixture grants are never labeled as earned fresh-save progression. */
export function createPlaythroughFixture(name: "unlocked-v1" | "victory-v1" | "economy-v1") {
  if (!["unlocked-v1", "economy-v1", "victory-v1"].includes(name)) throw new Error(`Unknown fixture: ${name}`);
  const save = createDefaultSaveData();
  save.finishedRunCharacters = Object.keys(characters) as CharacterId[];
  for (const hero of save.finishedRunCharacters) save.completedDifficulties[hero] = ["difficulty-1", "difficulty-2"];
  if (name === "economy-v1") {
    save.gold = 2000;
    for (const material of Object.keys(save.materialInventory) as Array<keyof typeof save.materialInventory>)
      save.materialInventory[material] = 1000;
    return save;
  }
  if (name === "unlocked-v1") return save;
  hydrateAlchemyPersistenceFields(save);
  restoreRun(null, save.talentXP, save.unlockedTalents);
  const { flow } = createPlaythroughController();
  flow.goToScreen("game-mode-select");
  flow.beginCampaign();
  flow.handleCharacterSelect("knight");
  flow.handleDifficultySelect("difficulty-1");
  const fixture = structuredClone(snapshotCareer());
  if (!fixture.activeRun?.activeCombat) throw new Error("Fixture did not start combat");
  fixture.activeRun.currentAct = ACTS_PER_RUN;
  fixture.activeRun.destinationIndexInAct = DESTINATIONS_PER_ACT;
  fixture.activeRun.activeCombat.battleState.enemyHealth = 0;
  fixture.activeRun.activeCombat.battleState.currentEnemy.enemyType = "boss";
  return fixture;
}
