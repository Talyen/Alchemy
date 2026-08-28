import type { GearStore } from "@/features/alchemy/shared/stores/gear-store-types";
import type { GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import { mutateGearWithRunHealthSync } from "@/features/alchemy/shared/stores/gear-session-command";
import { recordRunObtainedItem } from "@/features/alchemy/shared/stores/run-session-write-port";
import type { ResolvedRewardChoice } from "@/lib/active-run-session";
import { getRandomPotionCard } from "../navigation/reward-flow";
import { appendCardToRunWithDiscovery, appendBoonToRunWithDiscovery } from "./deck-mutations";
import { discoverTrinketIds } from "../../shared/stores/profile-store";
import type { RunFlowShellActions } from "./run-flow-shell-actions";
import { DESTINATIONS, ROUTE_SCREENS, type Destination } from "@/lib/routing";
import { ENEMY_TYPES } from "@/lib/game-data";

export type DestinationRouteDeps = Pick<
  RunFlowShellActions,
  "navigateTo" | "beginMysteryEvent" | "initializeShop" | "startBattle" | "startBoss"
> & { resetCorruption: () => void };

const DESTINATION_HANDLERS: Record<Destination, (deps: DestinationRouteDeps) => void> = {
  [DESTINATIONS.CAMPFIRE]: (deps) => deps.navigateTo(ROUTE_SCREENS.CAMPFIRE),
  [DESTINATIONS.CARD_SHOP]: (deps) => {
    deps.initializeShop("merchant");
    deps.navigateTo(ROUTE_SCREENS.SHOP);
  },
  [DESTINATIONS.ALCHEMIST_SHOP]: (deps) => {
    deps.initializeShop("alchemist");
    deps.navigateTo(ROUTE_SCREENS.ALCHEMIST);
  },
  [DESTINATIONS.TRINKET_SHOP]: (deps) => {
    deps.initializeShop("trinket");
    deps.navigateTo(ROUTE_SCREENS.TRINKET_SHOP);
  },
  [DESTINATIONS.EQUIPMENT_SHOP]: (deps) => {
    deps.initializeShop("equipment");
    deps.navigateTo(ROUTE_SCREENS.EQUIPMENT_SHOP);
  },
  [DESTINATIONS.MYSTERY]: (deps) => deps.beginMysteryEvent(),
  [DESTINATIONS.CORRUPTION]: (deps) => {
    deps.resetCorruption();
    deps.navigateTo(ROUTE_SCREENS.CORRUPTION);
  },
  [DESTINATIONS.ELITE_COMBAT]: (deps) => {
    deps.startBattle({ enemyType: ENEMY_TYPES.ELITE });
    deps.navigateTo(ROUTE_SCREENS.BATTLE);
  },
  [DESTINATIONS.BOSS_COMBAT]: (deps) => {
    deps.startBoss();
    deps.navigateTo(ROUTE_SCREENS.BATTLE);
  },
  [DESTINATIONS.NORMAL_COMBAT]: (deps) => {
    deps.startBattle({ enemyType: ENEMY_TYPES.NORMAL });
    deps.navigateTo(ROUTE_SCREENS.BATTLE);
  },
};

export function routeDestinationChoice(destination: Destination, deps: DestinationRouteDeps) {
  const handler = DESTINATION_HANDLERS[destination] ?? DESTINATION_HANDLERS[DESTINATIONS.NORMAL_COMBAT];
  handler(deps);
}

interface RewardSelectionInput {
  reward: ResolvedRewardChoice;
  draft: GameplayDraft;
}

export function applyRewardSelection({ reward, draft }: RewardSelectionInput) {
  switch (reward.rewardType) {
    case "card":
      appendCardToRunWithDiscovery(draft, reward.choice);
      return;
    case "boon":
      appendBoonToRunWithDiscovery(draft, reward.choice.id);
      return;
    case "trinket": {
      const trinketId = reward.choice.id;
      mutateGearWithRunHealthSync(draft, { mutate: (gear: GearStore) => gear.addTrinket(trinketId) });
      discoverTrinketIds(draft, [trinketId]);
      recordRunObtainedItem(draft, { kind: "trinket", trinketId });
      return;
    }
    case "gear": {
      const characterId = draft.run.activeRun.characterId;
      mutateGearWithRunHealthSync(draft, {
        mutate: (gear: GearStore) => gear.addInstance(reward.choice, characterId),
      });
      recordRunObtainedItem(draft, { kind: "gear", instance: reward.choice });
    }
  }
}

export function applyAlchemistPotion({ draft, rng }: { draft: GameplayDraft; rng: () => number }) {
  const potion = getRandomPotionCard(rng);
  appendCardToRunWithDiscovery(draft, potion);
}
