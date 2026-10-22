import "../../../../helpers/mock-audio";
import {
  bindRunMutationForTest,
  resetAllTestStores,
  resetGearForTest,
} from "../../../../helpers/run-domain-store-test";
import { beforeEach } from "vitest";
import { createShopActions } from "@/features/alchemy/run-loop/shop/create-shop-actions";
import { type BattleCard } from "@/lib/game-data";
import {
  acceptCommand,
  dispatchRunSessionCommand,
} from "@/features/alchemy/shared/stores/commands/run-session-command";
import {
  setShopState as mutateShopState,
  setAlchemistState as mutateAlchemistState,
  setTrinketShopState as mutateTrinketShopState,
  setEquipmentShopState as mutateEquipmentShopState,
  setRunBoons,
  setCurrentAct,
  setDestinationIndexInAct,
} from "@/features/alchemy/shared/stores/commands/run-session-write-port";
import {
  createInitialShopState as createInitialShopStateImpl,
  createInitialAlchemistState as createInitialAlchemistStateImpl,
  createInitialTrinketShopState as createInitialTrinketShopStateImpl,
  createInitialEquipmentShopState as createInitialEquipmentShopStateImpl,
} from "@/features/alchemy/run-loop/shop/shop-state-init";
import { makeTestCard } from "../../../../fixtures/cards";
import { makeEffect } from "../../../../fixtures/battle";
import { defaultGameSession } from "@/app/application-session";

const lootProgress = { depth: 24, highestCompletedDifficulty: null };

export const setShopState = bindRunMutationForTest(mutateShopState);
export const setAlchemistState = bindRunMutationForTest(mutateAlchemistState);
export const setTrinketShopState = bindRunMutationForTest(mutateTrinketShopState);
export const setEquipmentShopState = bindRunMutationForTest(mutateEquipmentShopState);

const testRng = () => 0.5;

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

export function buildActions(overrides?: { trinketIds: string[] }) {
  const trinketIds = overrides?.trinketIds;
  if (trinketIds) {
    dispatchRunSessionCommand((draft) => acceptCommand(setRunBoons(draft, trinketIds)), undefined, defaultGameSession);
  }
  return createShopActions(defaultGameSession);
}

beforeEach(() => {
  resetAllTestStores();
  resetGearForTest();
  dispatchRunSessionCommand(
    (draft) => {
      setCurrentAct(draft, 3);
      setDestinationIndexInAct(draft, 7);

      return acceptCommand();
    },
    undefined,
    defaultGameSession,
  );
});
