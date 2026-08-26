import "../../../../helpers/mock-audio";
import { expect, beforeEach } from "vitest";
import { createShopActions } from "@/features/alchemy/run-loop/shop/create-shop-actions";
import { createEmptyTalentEffectManifest, type BattleCard, type TalentEffectManifest } from "@/lib/game-data";
import { getRunProgressStoreView } from "../../../../helpers/run-domain-store-test";
import { createRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { useGearStore, resetAllTestStores } from "../../../../helpers/gameplay-store-test";
import {
  setShopState as mutateShopState,
  setAlchemistState as mutateAlchemistState,
  setTrinketShopState as mutateTrinketShopState,
  setEquipmentShopState as mutateEquipmentShopState,
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

export const setShopState = createRunSessionCommand(mutateShopState);
export const setAlchemistState = createRunSessionCommand(mutateAlchemistState);
export const setTrinketShopState = createRunSessionCommand(mutateTrinketShopState);
export const setEquipmentShopState = createRunSessionCommand(mutateEquipmentShopState);

const testRng = () => 0.5;
const defaultTalentEffects: TalentEffectManifest = createEmptyTalentEffectManifest();

export const createInitialShopState = (deck: BattleCard[] = []) => createInitialShopStateImpl(deck, testRng);
export const createInitialAlchemistState = (deck: BattleCard[] = []) => createInitialAlchemistStateImpl(deck, testRng);
export const createInitialTrinketShopState = (rng: () => number = testRng) => createInitialTrinketShopStateImpl(rng);
export const createInitialEquipmentShopState = (rng: () => number = testRng) =>
  createInitialEquipmentShopStateImpl(rng);

export function makeCard(overrides: Partial<BattleCard> = {}): BattleCard {
  return makeTestCard({ cost: 2, effects: [makeEffect("physical", 5)], ...overrides });
}

export function requiredItem<T>(value: T | undefined, label: string): T {
  expect(value, `${label} fixture should exist`).toBeDefined();
  return value as T;
}

export function buildActions(
  overrides?: Partial<{
    talentEffects: Partial<TalentEffectManifest>;
    homesteadEffects: Partial<typeof defaultHomesteadEffects>;
    gearAstralChanceBonus: number;
    trinketIds: string[];
  }>,
) {
  if (overrides?.trinketIds) {
    getRunProgressStoreView().setRunBoons(() => overrides.trinketIds!);
  }
  const talentEffects = { ...defaultTalentEffects, ...overrides?.talentEffects } as TalentEffectManifest;
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
  useGearStore.getState().reset();
});
