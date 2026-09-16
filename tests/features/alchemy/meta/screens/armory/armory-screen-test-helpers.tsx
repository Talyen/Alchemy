import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";
import { ArmoryScreen } from "@/features/alchemy/meta/screens/armory-screen";
import type { ArmoryScreenProps } from "@/features/alchemy/meta/screens/armory";
import {
  createEmptyEquippedTrinkets,
  createEmptyGearInventories,
  createEmptyGearLoadouts,
  type GearInstance,
} from "@/lib/gear";
import type { CharacterId } from "@/lib/game-data";
import { resetEscapeStackForTests } from "@/app/escape-stack";
import { resetGearForTest } from "../../../../../helpers/run-domain-store-test";
import { installDisabledAnimationsForTests } from "../../../../../helpers/animation-test";

const DEFAULT_ARMORY_INVENTORY: GearInstance[] = [
  { instanceId: "gear-sword", definitionId: "longsword-basic", affixes: [] },
  { instanceId: "gear-body", definitionId: "leather-armor-basic", affixes: [] },
];

export function createArmoryInventories(
  items: GearInstance[] = DEFAULT_ARMORY_INVENTORY,
  characterId: CharacterId = "knight",
) {
  const inventories = createEmptyGearInventories();
  inventories[characterId] = items;
  return inventories;
}

export function createArmoryScreenProps(overrides: Partial<ArmoryScreenProps> = {}): ArmoryScreenProps {
  return {
    inventories: createArmoryInventories(),
    loadouts: createEmptyGearLoadouts(),
    ownedTrinketIds: [],
    equippedTrinkets: createEmptyEquippedTrinkets(),
    finishedRunCharacters: ["knight"],
    combatRestrictions: { characters: {}, gear: {}, trinkets: {} },
    onEquip: vi.fn(),
    onUnequip: vi.fn(),
    onEquipTrinket: vi.fn(),
    onUnequipTrinket: vi.fn(),
    onSalvage: vi.fn(() => true),
    ...overrides,
  };
}

export function renderArmoryScreen(overrides: Partial<ArmoryScreenProps> = {}) {
  const props = createArmoryScreenProps(overrides);
  return { props, ...render(<ArmoryScreen {...props} />) };
}

export function installArmoryScreenTestHooks() {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }

  beforeEach(() => {
    resetEscapeStackForTests();
    resetGearForTest();
    localStorage.clear();
    vi.clearAllMocks();
  });
  installDisabledAnimationsForTests();

  afterEach(() => {
    cleanup();
    resetEscapeStackForTests();
  });
}
