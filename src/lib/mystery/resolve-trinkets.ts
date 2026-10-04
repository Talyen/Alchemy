import { isLootEligible, type LootProgress } from "@/lib/loot";
import { trinketLibrary } from "@/lib/game-data";
import { gearBaseItemList } from "@/lib/gear/base-items";
import { hashStringToUint32, pickRandom } from "@/lib/rng";

import type { MysteryEffect, MysteryEvent } from "./types";

function mysteryTrinketFallbackEffect(seed: string): Extract<MysteryEffect, { kind: "gainGeneratedGear" }> {
  const baseItem = gearBaseItemList[hashStringToUint32(seed) % gearBaseItemList.length];
  if (!baseItem) throw new Error("gearBaseItemList is empty");
  return { kind: "gainGeneratedGear", baseItemId: baseItem.id, astral: true };
}

function namedTrinketIds(effects: readonly MysteryEffect[]): string[] {
  return effects.flatMap((effect) => (effect.kind === "gainTrinket" ? [effect.trinketId] : []));
}

function pickRandomMysteryTrinketId(
  fromIds: readonly string[] | undefined,
  owned: ReadonlySet<string>,
  rng: () => number,
  reserved: ReadonlySet<string> = new Set(),
): string | undefined {
  const available = trinketLibrary.filter((entry) => !owned.has(entry.id) && !reserved.has(entry.id));
  const constrained = fromIds?.length ? available.filter((entry) => fromIds.includes(entry.id)) : [];
  return pickRandom(constrained.length > 0 ? constrained : available, rng)?.id;
}

export function pickMysteryTrinketGrantId({
  preferredId,
  fromIds,
  owned,
  rng,
}: {
  preferredId?: string | undefined;
  fromIds?: readonly string[] | undefined;
  owned: ReadonlySet<string>;
  rng: () => number;
}): string | undefined {
  if (preferredId && !owned.has(preferredId)) return preferredId;

  return pickRandomMysteryTrinketId(fromIds, owned, rng);
}

function resolveMysteryTrinketEffect(
  effect: MysteryEffect,
  owned: Set<string>,
  reservedNamedIds: ReadonlySet<string>,
  rng: () => number,
  fallbackSeed: string,
): MysteryEffect {
  if (effect.kind !== "gainTrinket" && effect.kind !== "gainRandomTrinket") return effect;
  const id =
    effect.kind === "gainTrinket"
      ? effect.trinketId
      : pickRandomMysteryTrinketId(effect.fromIds, owned, rng, reservedNamedIds);
  if (id === undefined || owned.has(id)) return mysteryTrinketFallbackEffect(fallbackSeed);
  owned.add(id);
  return effect.kind === "gainTrinket" ? effect : { kind: "gainTrinket", trinketId: id };
}

export function resolveMysteryEventTrinkets(
  event: MysteryEvent,
  ownedTrinketIds: readonly string[],
  rng: () => number,
): MysteryEvent {
  return {
    ...event,
    // Each choice resolves independently from the pre-event collection: the
    // player picks only one choice, so offerings must not steal from each
    // other. Effects within a single choice still accumulate, keeping
    // sequential random grants in one choice distinct.
    choices: event.choices.map((choice, choiceIndex) => {
      const choiceOwned = new Set(ownedTrinketIds);
      // A random grant cannot consume a Boon promised later in this choice.
      const reservedNamedIds = new Set(namedTrinketIds(choice.effects));
      return {
        ...choice,
        effects: choice.effects.map((effect, effectIndex) => {
          const seed = `${event.id}:${choiceIndex}:${effectIndex}`;
          return resolveMysteryTrinketEffect(effect, choiceOwned, reservedNamedIds, rng, seed);
        }),
      };
    }),
  };
}

export function eventHasUnresolvedRandomTrinket(event: MysteryEvent): boolean {
  return event.choices.some((choice) => choice.effects.some((effect) => effect.kind === "gainRandomTrinket"));
}

export function repairUnresolvedMysteryTrinkets(
  event: MysteryEvent,
  ownedTrinketIds: readonly string[],
  rng: () => number,
): MysteryEvent {
  if (!eventHasUnresolvedRandomTrinket(event)) return event;
  return resolveMysteryEventTrinkets(event, ownedTrinketIds, rng);
}

function isMysteryTrinketSlotEffect(effect: MysteryEffect): boolean {
  return (
    effect.kind === "gainTrinket" ||
    effect.kind === "gainRandomTrinket" ||
    (effect.kind === "gainGeneratedGear" && Boolean(effect.astral))
  );
}

export function applyResolvedMysteryTrinketIds(
  event: MysteryEvent,
  resolvedTrinketIds: readonly string[],
): MysteryEvent {
  if (resolvedTrinketIds.length === 0) return event;
  let index = 0;
  return {
    ...event,
    choices: event.choices.map((choice, choiceIndex) => ({
      label: choice.label,
      effects: choice.effects.map((effect, effectIndex) => {
        if (!isMysteryTrinketSlotEffect(effect)) return effect;
        const id = resolvedTrinketIds[index++];
        if (id === undefined) return effect;
        if (id === "") return mysteryTrinketFallbackEffect(`${event.id}:${choiceIndex}:${effectIndex}`);
        return { kind: "gainTrinket", trinketId: id };
      }),
    })),
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
      } else if (effect.kind === "gainRandomTrinket") remaining--;
    }
    return remaining >= 0;
  });
}
