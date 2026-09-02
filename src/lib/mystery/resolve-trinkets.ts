import { trinketLibrary } from "@/lib/game-data";
import { gearBaseItemList } from "@/lib/gear/base-items";
import { hashStringToUint32 } from "@/lib/rng";
import { pickRandom } from "@/lib/utils";

import type { MysteryEffect, MysteryEvent } from "./types";

function mysteryTrinketFallbackEffect(seed: string): Extract<MysteryEffect, { kind: "gainGeneratedGear" }> {
  const baseItem = gearBaseItemList[hashStringToUint32(seed) % gearBaseItemList.length];
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
      else if (effect.kind === "gainGeneratedGear" && effect.astral) ids.push("");
    }
  }
  return ids;
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
