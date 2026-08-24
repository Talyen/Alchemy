// Resolves mystery trinket grants so choice UI matches the item that will be given.
import { trinketLibrary } from "@/lib/game-data";
import { gearBaseItemList } from "@/lib/gear/base-items";
import { pickRandom } from "@/lib/utils";

import type { MysteryEffect, MysteryEvent } from "./types";

function isMysteryTrinketEffect(
  effect: MysteryEffect,
): effect is Extract<MysteryEffect, { kind: "gainTrinket" | "gainRandomTrinket" }> {
  return effect.kind === "gainTrinket" || effect.kind === "gainRandomTrinket";
}

function stableHashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Once every trinket is owned, a trinket grant becomes an astral gear drop instead of a
 * duplicate. Derived deterministically from the slot seed so resolution and save rehydration
 * agree without persisting extra state.
 */
function mysteryTrinketFallbackEffect(seed: string): Extract<MysteryEffect, { kind: "gainGeneratedGear" }> {
  const baseItem = gearBaseItemList[stableHashSeed(seed) % gearBaseItemList.length];
  if (!baseItem) throw new Error("gearBaseItemList is empty");
  return { kind: "gainGeneratedGear", baseItemId: baseItem.id, astral: true };
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
  rng: () => number,
  fallbackSeed: string,
): MysteryEffect {
  if (effect.kind !== "gainTrinket" && effect.kind !== "gainRandomTrinket") return effect;
  const id = pickMysteryTrinketGrantId(
    effect.kind === "gainTrinket"
      ? { preferredId: effect.trinketId, owned, rng }
      : { fromIds: effect.fromIds, owned, rng },
  );
  if (!id) return mysteryTrinketFallbackEffect(fallbackSeed);
  owned.add(id);
  return { kind: "gainTrinket", trinketId: id };
}

/** Rewrites trinket effects to concrete unowned IDs so choice badges match the grant. */
export function resolveMysteryEventTrinkets(
  event: MysteryEvent,
  ownedTrinketIds: readonly string[],
  rng: () => number,
): MysteryEvent {
  const owned = new Set(ownedTrinketIds);
  return {
    ...event,
    choices: event.choices.map((choice, choiceIndex) => ({
      label: choice.label,
      effects: choice.effects.map((effect, effectIndex) =>
        resolveMysteryTrinketEffect(effect, owned, rng, `${event.id}:${choiceIndex}:${effectIndex}`),
      ),
    })),
  };
}

export function collectResolvedMysteryTrinketIds(event: MysteryEvent): string[] {
  const ids: string[] = [];
  for (const choice of event.choices) {
    for (const effect of choice.effects) {
      if (effect.kind === "gainTrinket") ids.push(effect.trinketId);
      else if (effect.kind === "gainRandomTrinket") ids.push("");
      // "" keeps the positional contract for trinket slots replaced by the astral-gear fallback.
      else if (effect.kind === "gainGeneratedGear" && effect.astral) ids.push("");
    }
  }
  return ids;
}

export function eventHasUnresolvedRandomTrinket(event: MysteryEvent): boolean {
  return event.choices.some((choice) => choice.effects.some((effect) => effect.kind === "gainRandomTrinket"));
}

/** Resolve leftover gainRandomTrinket effects on a visit that predates resolvedTrinketIds. */
export function repairUnresolvedMysteryTrinkets(
  event: MysteryEvent,
  ownedTrinketIds: readonly string[],
  rng: () => number,
): MysteryEvent {
  if (!eventHasUnresolvedRandomTrinket(event)) return event;
  return resolveMysteryEventTrinkets(event, ownedTrinketIds, rng);
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
        if (!isMysteryTrinketEffect(effect)) return effect;
        const id = resolvedTrinketIds[index++];
        if (id === undefined) return effect;
        if (id === "") return mysteryTrinketFallbackEffect(`${event.id}:${choiceIndex}:${effectIndex}`);
        return { kind: "gainTrinket", trinketId: id };
      }),
    })),
  };
}
