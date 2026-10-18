import { createPlaythroughFixture } from "@/app/playthrough/fixtures";
import type { GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import {
  characters,
  getAllocatableTalentChoices,
  getTalentTreeKeywordIds,
  getTalentsForKeyword,
  trinketLibrary,
  tryUnlockTalent,
  xpThresholdForPoints,
  type CharacterId,
} from "@/lib/game-data";
import { gearDefinitionList } from "@/lib/gear/definitions";
import { createGearInstance, createRolledGearInstance } from "@/lib/gear/instances";
import { equipGear } from "@/lib/gear/loadout-operations";
import { GEAR_SLOTS, type GearInstance } from "@/lib/gear/types";
import { createSeededRng, pickRandom, rngInt, sampleItems } from "@/lib/rng";

/** Explicit fixture grants, applied before starting a run so production setup owns every combat effect. */
export function createRandomPerformanceAccount(seed: number, hero: CharacterId, gameSession: GameSession) {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff || !Object.hasOwn(characters, hero))
    throw new Error("Random performance account requires a uint32 seed and a known hero");
  const save = createPlaythroughFixture("unlocked-v1", gameSession);
  const gearRng = createSeededRng(seed ^ 0x6a09e667);
  const talentRng = createSeededRng(seed ^ 0xbb67ae85);
  const trinketRng = createSeededRng(seed ^ 0x3c6ef372);
  let itemId = 0;
  const createId = () => `performance-${seed}-${++itemId}`;
  const inventory = save.gearInventories[hero];
  const ownedUniques = new Set<string>();

  for (const slot of GEAR_SLOTS) {
    const candidates = gearDefinitionList.filter((definition) => {
      if (!definition.compatibleSlots.includes(slot) || ownedUniques.has(definition.id)) return false;
      const probe: GearInstance = { instanceId: "performance-probe", definitionId: definition.id, affixes: [] };
      const loadout = equipGear(save.gearLoadouts, hero, slot, probe, [...inventory, probe])[hero];
      // Use the equipment owner to enforce hand rules, including displacement.
      // A later off-hand must not erase the randomly chosen main-hand.
      return (
        loadout[slot] === probe.instanceId &&
        GEAR_SLOTS.every((existing) => existing === slot || loadout[existing] === save.gearLoadouts[hero][existing])
      );
    });
    const definition = pickRandom(candidates, gearRng);
    // A two-handed main-hand legitimately leaves no compatible off-hand.
    if (!definition) {
      if (slot !== "off-hand") throw new Error(`No performance gear candidates for ${slot}`);
      continue;
    }
    const instance =
      definition.rarity === "unique"
        ? createGearInstance(definition, [], createId)
        : createRolledGearInstance(definition, gearRng, createId);
    inventory.push(instance);
    save.gearLoadouts = equipGear(save.gearLoadouts, hero, slot, instance, inventory);
    if (definition.rarity === "unique") {
      ownedUniques.add(definition.id);
      save.discoveredUniqueIds.push(definition.id);
    }
  }

  const trinket = pickRandom(trinketLibrary, trinketRng);
  if (!trinket) throw new Error("No performance trinket candidates");
  save.ownedTrinketIds.push(trinket.id);
  save.discoveredTrinketIds.push(trinket.id);
  save.equippedTrinkets[hero] = trinket.id;

  const affinity = characters[hero].keywords;
  const selected = sampleItems(affinity, Math.min(affinity.length, 1 + rngInt(talentRng, 3)), talentRng);
  const other = getTalentTreeKeywordIds().filter((keyword) => !selected.includes(keyword));
  selected.push(...sampleItems(other, 2 + rngInt(talentRng, 3), talentRng));
  for (const keyword of selected) {
    const count = 1 + rngInt(talentRng, getTalentsForKeyword(keyword).length);
    save.talentXP[keyword] = xpThresholdForPoints(count);
    for (let index = 0; index < count; index++) {
      const talent = pickRandom(getAllocatableTalentChoices(keyword, save.unlockedTalents[keyword] ?? []), talentRng);
      if (!talent) throw new Error(`No legal performance talent choice for ${keyword}`);
      const unlocked = tryUnlockTalent(keyword, talent.id, save.talentXP, save.unlockedTalents);
      if (!unlocked.unlockedTalents) throw new Error(`Performance talent rejected: ${talent.id}`);
      save.unlockedTalents = unlocked.unlockedTalents;
    }
  }
  return save;
}
