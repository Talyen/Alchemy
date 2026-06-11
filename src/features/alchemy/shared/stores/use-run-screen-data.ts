// Selective run/session fields for screens — optimizes re-renders using useShallow.
import { useShallow } from "zustand/react/shallow";
import type { Screen } from "@/lib/routing";
import { getRunPhase } from "@/lib/routing";
import { useRunDomainStore } from "./run-domain-store";
import type { RunScreenData } from "./run-screen-data";

export type { RunScreenData } from "./run-screen-data";

const screenFields: Record<Screen, (keyof RunScreenData)[]> = {
  campfire: ["runPlayerHealth", "runMaxHealth"],
  shop: ["runGold", "runDeck", "shopState"],
  alchemist: ["runGold", "runDeck", "alchemistState"],
  "labyrinth-map": ["labyrinthMap"],
  rewards: ["rewardState"],
  destination: ["rewardState"],
  mystery: ["mysteryEvent", "mysteryCardChoices", "runDeck"],
  corruption: ["runDeck", "corruptionResult"],
  "game-over": ["runEndTalentXP", "talentXP", "runEndMaterials"],
  "run-victory": ["runEndTalentXP", "talentXP", "runEndMaterials"],
  "run-discoveries": ["runEndDiscoveredCardIds", "runEndDiscoveredTrinketIds"],
  // Screens that do not use screen data but must map to safe defaults
  options: [],
  menu: [],
  "character-select": [],
  "difficulty-select": [],
  "draft-deck": [],
  battle: [],
  "game-mode-select": [],
  collection: [],
  homestead: [],
  talents: [],
  "wildwood-select": [],
};

export function useRunScreenData(screen: Screen): RunScreenData {
  return useRunDomainStore(
    useShallow((state) => {
      const run = state.progress;
      const session = state.session;
      const battle = state.battle;
      const phase = getRunPhase(screen, battle.hasActiveBattle);

      const data: Partial<RunScreenData> = { phase };

      const fields = screenFields[screen] || [];
      for (const field of fields) {
        switch (field) {
          case "runPlayerHealth":
            data.runPlayerHealth = run.runPlayerHealth;
            break;
          case "runMaxHealth":
            data.runMaxHealth = run.runMaxHealth;
            break;
          case "runGold":
            data.runGold = run.runGold;
            break;
          case "runDeck":
            data.runDeck = run.runDeck;
            break;
          case "selectedDifficulty":
            data.selectedDifficulty = run.selectedDifficulty;
            break;
          case "talentXP":
            data.talentXP = run.talentXP;
            break;
          case "unlockedTalents":
            data.unlockedTalents = run.unlockedTalents;
            break;
          case "runTalentXP":
            data.runTalentXP = run.runTalentXP;
            break;
          case "runEndTalentXP":
            data.runEndTalentXP = session.runEndTalentXP;
            break;
          case "hasActiveRun":
            data.hasActiveRun = session.hasActiveRun;
            break;
          case "hasActiveBattle":
            data.hasActiveBattle = battle.hasActiveBattle;
            break;
          case "battleState":
            data.battleState = battle.battleState;
            break;
          case "rewardState":
            data.rewardState = session.rewardState;
            break;
          case "labyrinthMap":
            data.labyrinthMap = session.labyrinthMap;
            break;
          case "mysteryEvent":
            data.mysteryEvent = session.mysteryEvent;
            break;
          case "mysteryCardChoices":
            data.mysteryCardChoices = session.mysteryCardChoices;
            break;
          case "corruptionResult":
            data.corruptionResult = session.corruptionResult;
            break;
          case "shopState":
            data.shopState = session.shopState;
            break;
          case "alchemistState":
            data.alchemistState = session.alchemistState;
            break;
          case "runEndMaterials":
            data.runEndMaterials = session.runEndMaterials;
            break;
          case "runEndDiscoveredCardIds":
            data.runEndDiscoveredCardIds = session.runEndDiscoveredCardIds;
            break;
          case "runEndDiscoveredTrinketIds":
            data.runEndDiscoveredTrinketIds = session.runEndDiscoveredTrinketIds;
            break;
          case "pendingCharacterId":
            data.pendingCharacterId = session.pendingCharacterId;
            break;
        }
      }

      return data as RunScreenData;
    }),
  );
}
