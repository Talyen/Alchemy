import "../../../../helpers/mock-audio";
import { beforeEach } from "vitest";
import { createShopActions } from "@/features/alchemy/run-loop/shop/create-shop-actions";
import { createEmptyTalentEffectManifest, type BattleCard, type TalentEffectManifest } from "@/lib/game-data";
import {
  acceptCommand,
  dispatchRunSessionCommand,
  createRunSessionCommand,
} from "@/features/alchemy/shared/stores/run-session-command";
import { resetAllTestStores, resetGearForTest } from "../../../../helpers/run-domain-store-test";
import {
  setShopState as mutateShopState,
  setAlchemistState as mutateAlchemistState,
  setTrinketShopState as mutateTrinketShopState,
  setEquipmentShopState as mutateEquipmentShopState,
  setRunBoons,
  setCurrentAct,
  setDestinationIndexInAct,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import {
  createInitialShopState as createInitialShopStateImpl,
  createInitialAlchemistState as createInitialAlchemistStateImpl,
  createInitialTrinketShopState as createInitialTrinketShopStateImpl,
  createInitialEquipmentShopState as createInitialEquipmentShopStateImpl,
} from "@/features/alchemy/run-loop/shop/shop-state-init";
import { defaultHomesteadEffects } from "@/lib/homestead/defaults";
import { makeTestCard } from "../../../../fixtures/cards";
import { makeEffect } from "../../../../fixtures/battle";

const lootProgress = { depth: 24, highestCompletedDifficulty: null };

export const setShopState = createRunSessionCommand((...args: Parameters<typeof mutateShopState>) =>
  acceptCommand(mutateShopState(...args)),
);
export const setAlchemistState = createRunSessionCommand((...args: Parameters<typeof mutateAlchemistState>) =>
  acceptCommand(mutateAlchemistState(...args)),
);
export const setTrinketShopState = createRunSessionCommand((...args: Parameters<typeof mutateTrinketShopState>) =>
  acceptCommand(mutateTrinketShopState(...args)),
);
export const setEquipmentShopState = createRunSessionCommand((...args: Parameters<typeof mutateEquipmentShopState>) =>
  acceptCommand(mutateEquipmentShopState(...args)),
);

const testRng = () => 0.5;
const defaultTalentEffects: TalentEffectManifest = createEmptyTalentEffectManifest();

export const createInitialShopState = (deck: BattleCard[] = []) => createInitialShopStateImpl(deck, testRng);
export const createInitialAlchemistState = (deck: BattleCard[] = []) => createInitialAlchemistStateImpl(deck, testRng);
export const createInitialTrinketShopState = (rng: () => number = testRng) => createInitialTrinketShopStateImpl(rng);
export const createInitialEquipmentShopState = (rng: () => number = testRng) =>
  createInitialEquipmentShopStateImpl(rng, lootProgress);

export function makeCard(overrides: Partial<BattleCard> = {}): BattleCard {
  return makeTestCard({ cost: 2, effects: [makeEffect("physical", 5)], ...overrides });
}

export function requiredItem<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`${label} fixture should exist`);
  return value;
}

export function buildActions(
  overrides?: Partial<{
    talentEffects: Partial<TalentEffectManifest>;
    homesteadEffects: Partial<typeof defaultHomesteadEffects>;
    gearAstralChanceBonus: number;
    trinketIds: string[];
  }>,
) {
  const trinketIds = overrides?.trinketIds;
  if (trinketIds) {
    dispatchRunSessionCommand((draft) => acceptCommand(setRunBoons(draft, trinketIds)));
  }
  const talentEffects = { ...defaultTalentEffects, ...overrides?.talentEffects };
  return createShopActions({
    talentEffects,
    homesteadEffects: {
      ...defaultHomesteadEffects,
      gearAstralChanceBonus: overrides?.gearAstralChanceBonus ?? 0,
      ...overrides?.homesteadEffects,
    },
  });
}

beforeEach(() => {
  resetAllTestStores();
  resetGearForTest();
  dispatchRunSessionCommand((draft) => {
    setCurrentAct(draft, 3);
    setDestinationIndexInAct(draft, 7);

    return acceptCommand();
  });
});
