// Resolves mystery trinket grants so choice UI matches the item that will be given.
import { trinketLibrary } from "@/lib/game-data";
import { pickRandom } from "@/lib/utils";

import type { MysteryEffect, MysteryEvent } from "./types";

function isMysteryTrinketEffect(
  effect: MysteryEffect,
): effect is Extract<MysteryEffect, { kind: "gainTrinket" | "gainRandomTrinket" }> {
  return effect.kind === "gainTrinket" || effect.kind === "gainRandomTrinket";
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
  if (unowned.length > 0) return pickRandom(unowned, rng)?.id;

  return preferredId ?? fromIds?.[0];
}

function resolveMysteryTrinketEffect(effect: MysteryEffect, owned: Set<string>, rng: () => number): MysteryEffect {
  if (effect.kind === "gainTrinket") {
    const id = pickMysteryTrinketGrantId({ preferredId: effect.trinketId, owned, rng });
    if (!id) return effect;
    owned.add(id);
    return { kind: "gainTrinket", trinketId: id };
  }
  if (effect.kind === "gainRandomTrinket") {
    const id = pickMysteryTrinketGrantId({ fromIds: effect.fromIds, owned, rng });
    if (!id) return effect;
    owned.add(id);
    return { kind: "gainTrinket", trinketId: id };
  }
  return effect;
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
    choices: event.choices.map((choice) => ({
      label: choice.label,
      effects: choice.effects.map((effect) => resolveMysteryTrinketEffect(effect, owned, rng)),
    })),
  };
}

export function collectResolvedMysteryTrinketIds(event: MysteryEvent): string[] {
  const ids: string[] = [];
  for (const choice of event.choices) {
    for (const effect of choice.effects) {
      if (effect.kind === "gainTrinket") ids.push(effect.trinketId);
      else if (effect.kind === "gainRandomTrinket") ids.push("");
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
    choices: event.choices.map((choice) => ({
      label: choice.label,
      effects: choice.effects.map((effect) => {
        if (!isMysteryTrinketEffect(effect)) return effect;
        const id = resolvedTrinketIds[index++];
        if (!id) return effect;
        return { kind: "gainTrinket", trinketId: id };
      }),
    })),
  };
}
