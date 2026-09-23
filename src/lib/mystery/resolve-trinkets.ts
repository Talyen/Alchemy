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

  const constrained = fromIds?.length
    ? trinketLibrary.filter((entry) => fromIds.includes(entry.id) && !owned.has(entry.id))
    : [];
  if (constrained.length > 0) return pickRandom(constrained, rng)?.id;

  const unowned = trinketLibrary.filter((entry) => !owned.has(entry.id));
  return pickRandom(unowned, rng)?.id;
}

function resolveMysteryTrinketEffect(
  effect: MysteryEffect,
  owned: Set<string>,
  reservedNamedIds: ReadonlySet<string>,
  rng: () => number,
  fallbackSeed: string,
): MysteryEffect {
  if (effect.kind !== "gainTrinket" && effect.kind !== "gainRandomTrinket") return effect;
  if (effect.kind === "gainTrinket" && owned.has(effect.trinketId)) {
    // The named reward is already owned: grant fallback gear rather than an
    // unrelated random trinket the narrative does not name.
    return mysteryTrinketFallbackEffect(fallbackSeed);
  }
  const id = pickMysteryTrinketGrantId(
    effect.kind === "gainTrinket"
      ? { preferredId: effect.trinketId, owned, rng }
      : { fromIds: effect.fromIds, owned: new Set([...owned, ...reservedNamedIds]), rng },
  );
  if (!id) return mysteryTrinketFallbackEffect(fallbackSeed);
  owned.add(id);
  return { kind: "gainTrinket", trinketId: id };
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
  const availableTrinkets = trinketLibrary.filter((entry) => !owned.has(entry.id)).length;
  return event.choices.every((choice) => {
    if (choice.effects.some((effect) => effect.kind === "gainGeneratedGear" && effect.astral)) return false;
    const namedIds = namedTrinketIds(choice.effects);
    if (namedIds.some((id) => owned.has(id)) || new Set(namedIds).size !== namedIds.length) return false;
    const randomCount = choice.effects.filter((effect) => effect.kind === "gainRandomTrinket").length;
    return namedIds.length + randomCount <= availableTrinkets;
  });
}
