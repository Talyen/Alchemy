import { readActiveRun, readRunProfile, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import type { GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { cardSlotKeyOf } from "@/features/alchemy/run-loop/shop/shop-commands-core";
import { getCampfireBrewKind, isBrewablePotion } from "@/lib/alchemist/brewing";
import { computeTalentEffects } from "@/lib/game-data";
import { brewCandidates, potionPurchaseScore, potionUtility } from "./brewing-policy";
import type { OfferChoice } from "./choice-catalog";
import type { createPlaythroughController } from "./controller";
import type { CareerConfig } from "./types";

export interface BrewingOpportunity {
  kind: "mix" | "distill" | "purchase" | "refresh" | "campfire-new" | "campfire-mix";
  eligible: number;
  affordable: number;
  beneficial: number;
  reason: string;
}

export interface BrewingObservation {
  activity: "alchemist" | "campfire";
  room: number;
  opportunities: BrewingOpportunity[];
}

export function offerBrewingChoices(
  config: CareerConfig,
  controller: ReturnType<typeof createPlaythroughController>,
  offer: OfferChoice,
  gameSession: GameSession,
): BrewingObservation | null {
  const activity = readRunSession(gameSession).activity;
  if (activity.kind !== "alchemist" && activity.kind !== "campfire") return null;
  const run = readActiveRun(gameSession);
  const profile = readRunProfile(gameSession);
  const potency = computeTalentEffects(profile.unlockedTalents).potionMixPotency;
  const candidates = brewCandidates(run.runDeck, potency);
  const enabled = config.brewing === "on";
  const observation: BrewingObservation = { activity: activity.kind, room: run.roomsEncountered, opportunities: [] };
  const opportunities = observation.opportunities;
  if (activity.kind === "campfire") {
    if (activity.data.completed) {
      offer("campfire", "rest", 1, controller.flow.handleCampfireContinue);
      return observation;
    }
    const urgent = run.runPlayerHealth < run.runMaxHealth / 2;
    // Retain the old composite Rest + Continue identity for journal replay.
    offer("campfire", "rest", urgent ? 1000 : 1, controller.flow.handleCampfireContinue);
    const kind = getCampfireBrewKind(run.runDeck);
    const combinations = candidates.filter((c) => c.kind === "mix");
    const useful =
      kind === "new"
        ? activity.data.offers.filter((card) => potionPurchaseScore(card, run.runDeck) > 0).length
        : combinations.filter((c) => c.improvement > 0).length;
    opportunities.push({
      kind: kind === "new" ? "campfire-new" : "campfire-mix",
      eligible: kind === "new" ? activity.data.offers.length : combinations.length,
      affordable: kind === "new" ? activity.data.offers.length : combinations.length,
      beneficial: useful,
      reason: !enabled ? "disabled" : urgent ? "survival-priority" : useful ? "available" : "no-improvement",
    });
    if (!enabled) return observation;
    if (kind === "new")
      activity.data.offers.forEach((card, index) => {
        offer(
          "campfire-new",
          card.id,
          potionPurchaseScore(card, run.runDeck),
          () => controller.alchemy.brewAtCampfire({ kind: "new", offerIndex: index }),
          index,
        );
      });
    else
      for (const c of combinations) {
        const [a, b] = c.indices as [number, number];
        offer("campfire-mix", `${a}:${b}`, c.improvement > 0 ? 2 + c.improvement : -1, () =>
          controller.alchemy.brewAtCampfire({ kind: "combine", indices: [a, b] }),
        );
      }
    return observation;
  }

  const actions = controller.shop().alchemist;
  const price = actions.getMixPrice();
  const serviceOpen = !activity.data.mixUsed;
  const usefulService = serviceOpen && candidates.some((c) => c.improvement > 0);
  const reserve = enabled && usefulService ? price : 0;
  for (const kind of ["mix", "distill"] as const) {
    const selected = candidates.filter((c) => c.kind === kind);
    opportunities.push({
      kind,
      eligible: selected.length,
      affordable: serviceOpen && profile.gold >= price ? selected.length : 0,
      beneficial: selected.filter((c) => c.improvement > 0).length,
      reason: !enabled
        ? "disabled"
        : !serviceOpen
          ? "service-exhausted"
          : !selected.length
            ? "ineligible"
            : profile.gold < price
              ? "insufficient-gold"
              : selected.some((c) => c.improvement > 0)
                ? "available"
                : "no-improvement",
    });
    if (!enabled || !serviceOpen || profile.gold < price) continue;
    for (const c of selected) {
      const [a, b] = c.indices;
      offer(kind, c.indices.join(":"), c.improvement > 0 ? 10 + c.improvement : -1, () =>
        kind === "mix" ? actions.mixPotions(a!, b!) : actions.strengthenPotion(a!),
      );
    }
  }
  let eligible = 0,
    affordable = 0,
    beneficial = 0;
  activity.data.potions.forEach((card, index) => {
    const key = cardSlotKeyOf(card, index);
    if (activity.data.purchasedSlotKeys.includes(key)) return;
    eligible++;
    const buyPrice = actions.getPotionBuyPrice(card);
    const score = potionPurchaseScore(card, run.runDeck);
    if (score > 0) beneficial++;
    if (buyPrice > profile.gold) return;
    affordable++;
    offer(
      "buy-potion",
      card.id,
      buyPrice + reserve > profile.gold ? -1 : score,
      () => actions.buyPotion(card, key),
      index,
    );
  });
  opportunities.push({
    kind: "purchase",
    eligible,
    affordable,
    beneficial,
    reason: !affordable
      ? "insufficient-gold"
      : !beneficial
        ? "no-improvement"
        : reserve > 0
          ? "brewing-reserve"
          : "available",
  });
  const refreshPrice = actions.getRefreshPrice(activity.data.refreshesLeft, undefined, activity.data.freeRefreshUsed);
  const canRefresh = activity.data.refreshesLeft > 0;
  const canAffordRefresh = profile.gold >= refreshPrice + reserve;
  const usefulAvailable =
    (usefulService && enabled && profile.gold >= price) ||
    activity.data.potions.some(
      (card, index) =>
        !activity.data.purchasedSlotKeys.includes(cardSlotKeyOf(card, index)) &&
        potionPurchaseScore(card, run.runDeck) > 0 &&
        actions.getPotionBuyPrice(card) + reserve <= profile.gold,
    );
  // A refresh also needs enough remaining Gold to buy the cheapest visible Potion.
  // This uses visible prices only; it never peeks at future shop RNG.
  const hasPotionRoom = run.runDeck.filter(isBrewablePotion).length < 4;
  const cheapest = Math.min(...activity.data.potions.map((card) => actions.getPotionBuyPrice(card)));
  const worthwhile =
    !usefulAvailable &&
    hasPotionRoom &&
    profile.gold >= refreshPrice + reserve + cheapest &&
    activity.data.potions.some((card) => potionUtility(card) > 0);
  opportunities.push({
    kind: "refresh",
    eligible: Number(canRefresh),
    affordable: Number(canRefresh && canAffordRefresh),
    beneficial: Number(worthwhile),
    reason: !canRefresh
      ? "service-exhausted"
      : !canAffordRefresh
        ? "insufficient-gold"
        : !hasPotionRoom
          ? "potion-cap"
          : usefulAvailable
            ? "available-option-preferred"
            : worthwhile
              ? "seek-better-stock"
              : "purchase-reserve",
  });
  if (canRefresh && canAffordRefresh) offer("alchemist-refresh", "refresh", worthwhile ? 0.5 : -1, actions.refresh);
  offer("shop-continue", "continue", 0, controller.flow.advanceToNextDestination);
  return observation;
}
