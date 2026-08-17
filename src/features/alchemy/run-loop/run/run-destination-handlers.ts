// Destination routing helpers and reward selection utilities for run flow.
import type { BattleCard } from "@/lib/game-data";
import type { GearInstance } from "@/lib/gear";
import type { GearStore } from "@/features/alchemy/shared/stores/gear-store-types";
import type { GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import { mutateGearWithRunHealthSync } from "@/features/alchemy/shared/stores/gear-session-command";
import type { RewardState } from "@/lib/active-run-session";
import type { Destination } from "@/lib/routing";
import { CONSTANTS } from "../../shared/types";
import { getRandomPotionCard } from "../navigation/reward-flow";
import { appendCardToRunWithDiscovery, appendTrinketToRunWithDiscovery } from "./deck-mutations";
import type { RunFlowShellActions } from "./run-flow-shell-actions";

export type DestinationRouteDeps = Pick<
  RunFlowShellActions,
  "navigateTo" | "beginMysteryEvent" | "initializeShop" | "startBattle" | "startBoss"
> & { resetCorruption: () => void };

const DESTINATION_HANDLERS: Record<Destination, (deps: DestinationRouteDeps) => void> = {
  [CONSTANTS.DESTINATIONS.CAMPFIRE]: (deps) => deps.navigateTo(CONSTANTS.SCREENS.CAMPFIRE),
  [CONSTANTS.DESTINATIONS.MERCHANT_SHOP]: (deps) => {
    deps.initializeShop("merchant");
    deps.navigateTo(CONSTANTS.SCREENS.SHOP);
  },
  [CONSTANTS.DESTINATIONS.ALCHEMIST_SHOP]: (deps) => {
    deps.initializeShop("alchemist");
    deps.navigateTo(CONSTANTS.SCREENS.ALCHEMIST);
  },
  [CONSTANTS.DESTINATIONS.TRINKET_SHOP]: (deps) => {
    deps.initializeShop("trinket");
    deps.navigateTo(CONSTANTS.SCREENS.TRINKET_SHOP);
  },
  [CONSTANTS.DESTINATIONS.EQUIPMENT_SHOP]: (deps) => {
    deps.initializeShop("equipment");
    deps.navigateTo(CONSTANTS.SCREENS.EQUIPMENT_SHOP);
  },
  [CONSTANTS.DESTINATIONS.MYSTERY]: (deps) => deps.beginMysteryEvent(),
  [CONSTANTS.DESTINATIONS.CORRUPTION]: (deps) => {
    deps.resetCorruption();
    deps.navigateTo(CONSTANTS.SCREENS.CORRUPTION);
  },
  [CONSTANTS.DESTINATIONS.ELITE_COMBAT]: (deps) => {
    deps.startBattle({ enemyType: CONSTANTS.ENEMY_TYPES.ELITE });
    deps.navigateTo(CONSTANTS.SCREENS.BATTLE);
  },
  [CONSTANTS.DESTINATIONS.BOSS_COMBAT]: (deps) => {
    deps.startBoss();
    deps.navigateTo(CONSTANTS.SCREENS.BATTLE);
  },
  [CONSTANTS.DESTINATIONS.NORMAL_COMBAT]: (deps) => {
    deps.startBattle({ enemyType: CONSTANTS.ENEMY_TYPES.NORMAL });
    deps.navigateTo(CONSTANTS.SCREENS.BATTLE);
  },
};

export function routeDestinationChoice(destination: Destination, deps: DestinationRouteDeps) {
  const handler = DESTINATION_HANDLERS[destination] ?? DESTINATION_HANDLERS[CONSTANTS.DESTINATIONS.NORMAL_COMBAT];
  handler(deps);
}

interface RewardSelectionInput {
  choice: BattleCard | { id: string } | GearInstance;
  type: RewardState["rewardType"];
  draft: GameplayDraft;
}

export function applyRewardSelection({ choice, type, draft }: RewardSelectionInput) {
  if (type === "card") {
    appendCardToRunWithDiscovery(draft, choice as BattleCard);
  } else if (type === "trinket") {
    appendTrinketToRunWithDiscovery(draft, (choice as { id: string }).id);
  } else if (type === "gear") {
    const characterId = draft.run.activeRun.characterId;
    mutateGearWithRunHealthSync(draft, {
      characterId,
      mutate: (gear: GearStore) => gear.addInstance(choice as GearInstance, characterId),
    });
  }
}

export function applyAlchemistPotion({ draft, rng }: { draft: GameplayDraft; rng: () => number }) {
  const potion = getRandomPotionCard(rng);
  appendCardToRunWithDiscovery(draft, potion);
}
