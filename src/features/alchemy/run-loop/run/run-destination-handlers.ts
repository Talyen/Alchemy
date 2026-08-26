// Destination routing helpers and reward selection utilities for run flow.
import type { GearInstance } from "@/lib/gear";
import type { GearStore } from "@/features/alchemy/shared/stores/gear-store-types";
import type { GameplayDraft } from "@/features/alchemy/shared/stores/run-session-command";
import { mutateGearWithRunHealthSync } from "@/features/alchemy/shared/stores/gear-session-command";
import { recordRunObtainedItem } from "@/features/alchemy/shared/stores/run-session-write-port";
import type { RewardState } from "@/lib/active-run-session";
import { getRandomPotionCard } from "../navigation/reward-flow";
import { appendCardToRunWithDiscovery, appendBoonToRunWithDiscovery } from "./deck-mutations";
import { discoverTrinketIds } from "../../shared/stores/profile-store";
import type { RunFlowShellActions } from "./run-flow-shell-actions";
import { DESTINATIONS, ROUTE_SCREENS, type Destination } from "@/lib/routing";
import { ENEMY_TYPES, type BattleCard } from "@/lib/game-data";

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
  choice: BattleCard | { id: string } | GearInstance;
  type: RewardState["rewardType"];
  draft: GameplayDraft;
}

export function applyRewardSelection({ choice, type, draft }: RewardSelectionInput) {
  if (type === "card") {
    appendCardToRunWithDiscovery(draft, choice as BattleCard);
  } else if (type === "boon") {
    appendBoonToRunWithDiscovery(draft, (choice as { id: string }).id);
  } else if (type === "trinket") {
    const trinketId = (choice as { id: string }).id;
    mutateGearWithRunHealthSync(draft, { mutate: (gear: GearStore) => gear.addTrinket(trinketId) });
    discoverTrinketIds(draft, [trinketId]);
    recordRunObtainedItem(draft, { kind: "trinket", trinketId });
  } else if (type === "gear") {
    const characterId = draft.run.activeRun.characterId;
    const instance = choice as GearInstance;
    mutateGearWithRunHealthSync(draft, {
      mutate: (gear: GearStore) => gear.addInstance(instance, characterId),
    });
    recordRunObtainedItem(draft, { kind: "gear", instance });
  }
}

export function applyAlchemistPotion({ draft, rng }: { draft: GameplayDraft; rng: () => number }) {
  const potion = getRandomPotionCard(rng);
  appendCardToRunWithDiscovery(draft, potion);
}
