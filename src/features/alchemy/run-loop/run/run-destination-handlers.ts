// Destination routing helpers and reward selection utilities for run flow.
import type { BattleCard } from "@/lib/game-data";
import type { GearInstance } from "@/lib/gear";
import type { RunDeckUpdate, RunTrinketsUpdate } from "@/features/alchemy/shared/stores/run-session-write-port";
import { dispatchGearMutationWithRunHealthSync } from "@/features/alchemy/shared/stores/gear-session-command";
import { readActiveRun } from "@/features/alchemy/shared/stores/run-session-read-port";
import type { RewardState } from "../navigation/reward-flow";
import { getRandomPotionCard } from "../navigation/reward-flow";
import { appendCardToRunWithDiscovery, appendTrinketToRunWithDiscovery } from "./deck-mutations";
import type { RunFlowShellActions } from "./run-flow-shell-actions";
import { CONSTANTS, type Destination } from "../../shared/types";

export type DestinationRouteDeps = Pick<
  RunFlowShellActions,
  "navigateTo" | "beginMysteryEvent" | "initShop" | "startBattle" | "startBoss"
> & { resetCorruption: () => void };

const DESTINATION_HANDLERS: Record<Destination, (deps: DestinationRouteDeps) => void> = {
  [CONSTANTS.DESTINATIONS.CAMPFIRE]: (deps) => deps.navigateTo(CONSTANTS.SCREENS.CAMPFIRE),
  [CONSTANTS.DESTINATIONS.MERCHANT_SHOP]: (deps) => {
    deps.initShop("shop");
    deps.navigateTo(CONSTANTS.SCREENS.SHOP);
  },
  [CONSTANTS.DESTINATIONS.ALCHEMIST_SHOP]: (deps) => {
    deps.initShop("alchemist");
    deps.navigateTo(CONSTANTS.SCREENS.ALCHEMIST);
  },
  [CONSTANTS.DESTINATIONS.TRINKET_SHOP]: (deps) => {
    deps.initShop("trinket");
    deps.navigateTo(CONSTANTS.SCREENS.TRINKET_SHOP);
  },
  [CONSTANTS.DESTINATIONS.EQUIPMENT_SHOP]: (deps) => {
    deps.initShop("equipment");
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
  setRunDeck: (value: RunDeckUpdate) => void;
  setRunTrinkets: (value: RunTrinketsUpdate) => void;
}

export function applyRewardSelection({ choice, type, setRunDeck, setRunTrinkets }: RewardSelectionInput) {
  if (type === "card") {
    appendCardToRunWithDiscovery(choice as BattleCard, setRunDeck);
  } else if (type === "trinket") {
    appendTrinketToRunWithDiscovery((choice as { id: string }).id, setRunTrinkets);
  } else if (type === "gear") {
    const characterId = readActiveRun().characterId;
    dispatchGearMutationWithRunHealthSync({
      characterId,
      mutate: (gear) => gear.addInstance(choice as GearInstance, characterId),
    });
  }
}

export function applyAlchemistPotion({
  setRunDeck,
  rng,
}: {
  setRunDeck: (value: RunDeckUpdate) => void;
  rng: () => number;
}) {
  const potion = getRandomPotionCard(rng);
  appendCardToRunWithDiscovery(potion, setRunDeck);
}
