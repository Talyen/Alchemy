import { isLootEligible, type LootProgress } from "@/lib/loot";
import { trinketLibrary } from "@/lib/game-data";
import { gearBaseItemList } from "@/lib/gear/base-items";
import { hashStringToUint32 } from "@/lib/rng";

import type { MysteryEffect, MysteryEvent } from "./types";

function mysteryTrinketFallbackEffect(seed: string): Extract<MysteryEffect, { kind: "gainGeneratedGear" }> {
  const baseItem = gearBaseItemList[hashStringToUint32(seed) % gearBaseItemList.length];
  if (!baseItem) throw new Error("gearBaseItemList is empty");
  return { kind: "gainGeneratedGear", baseItemId: baseItem.id, astral: true };
}

function resolveMysteryTrinketEffect(effect: MysteryEffect, owned: Set<string>, fallbackSeed: string): MysteryEffect {
  if (effect.kind !== "gainTrinket") return effect;
  if (owned.has(effect.trinketId)) return mysteryTrinketFallbackEffect(fallbackSeed);
  owned.add(effect.trinketId);
  return effect;
}

export function resolveMysteryEventTrinkets(
  event: MysteryEvent,
  ownedTrinketIds: readonly string[],
  _rng?: () => number,
): MysteryEvent {
  return {
    ...event,
    // Each choice resolves independently from the pre-event collection: the
    // player picks only one choice, so offerings must not steal from each
    // other. Effects within a single choice still accumulate, keeping
    // sequential grants in one choice distinct.
    choices: event.choices.map((choice, choiceIndex) => {
      const choiceOwned = new Set(ownedTrinketIds);
      return {
        ...choice,
        effects: choice.effects.map((effect, effectIndex) =>
          resolveMysteryTrinketEffect(effect, choiceOwned, `${event.id}:${choiceIndex}:${effectIndex}`),
        ),
      };
    }),
  };
}

export function isMysteryLootEligible(
  event: MysteryEvent,
  progress: LootProgress,
  ownedTrinketIds: readonly string[],
): boolean {
  if (isLootEligible("astral", progress.depth)) return true;
  const owned = new Set(ownedTrinketIds);
  const availableTrinkets = trinketLibrary.reduce((count, entry) => count + Number(!owned.has(entry.id)), 0);
  return event.choices.every((choice) => {
    const reserved = new Set(owned);
    let remaining = availableTrinkets;
    for (const effect of choice.effects) {
      if (effect.kind === "gainGeneratedGear" && effect.astral) return false;
      if (effect.kind === "gainTrinket") {
        if (reserved.has(effect.trinketId)) return false;
        reserved.add(effect.trinketId);
        remaining--;
      }
    }
    return remaining >= 0;
  });
}
