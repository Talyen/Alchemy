import {
  setAlchemyVisit,
  clearMysteryVisitState,
  setMysteryEvent,
} from "@/features/alchemy/shared/stores/commands/run-session-write-port";
import { readActivityData } from "@/lib/active-run-session";
import { createCampfirePotionOffers } from "@/lib/alchemist/brewing";
import { createTransmutationOffers } from "@/lib/alchemist/transmutation";
import {
  activeLabyrinthBenefits,
  applyLabyrinthMysteryModifiers,
  isLabyrinthMysteryEligible,
} from "@/lib/content-systems/labyrinth/room-rules";
import { isMysteryLootEligible, pickResolvedMysteryEvent } from "@/lib/mystery";
import { combineTrinketEffectIds } from "@/lib/trinkets";
import { resolveDraftLootProgress } from "@/features/alchemy/shared/stores/commands/loot-progress";
import {
  snapshotTransactionValue,
  type RunTransaction,
} from "@/features/alchemy/shared/stores/commands/run-session-command";
import {
  createDraftInstanceIdSource,
  createDraftRunRandomSource,
  setRunActivityData,
} from "@/features/alchemy/shared/stores/commands/run-session-write-port";
import { getOwnedUniqueDefinitionIds } from "@/lib/gear";
import type { ShopActivity } from "@/lib/active-run-session";
import { draftShopDiscounts } from "../shop/shop-pricing";
import {
  createInitialShopState,
  createInitialAlchemistState,
  createInitialTrinketShopState,
  createInitialEquipmentShopState,
} from "../shop/shop-state-init";

export function initializeShopVisit(draft: RunTransaction, kind: ShopActivity): void {
  const rng = createDraftRunRandomSource(draft, "shops");
  const modifiers = draftShopDiscounts(draft).modifiers;
  switch (kind) {
    case "shop":
      setRunActivityData(
        draft,
        "shop",
        createInitialShopState(snapshotTransactionValue(draft.run.activeRun.runDeck), rng, modifiers),
      );
      break;
    case "alchemist":
      setRunActivityData(
        draft,
        "alchemist",
        createInitialAlchemistState(snapshotTransactionValue(draft.run.activeRun.runDeck), rng, modifiers),
      );
      break;
    case "trinket-shop":
      setRunActivityData(draft, "trinket-shop", createInitialTrinketShopState(rng, draft.gear.ownedTrinketIds));
      break;
    case "equipment-shop":
      setRunActivityData(
        draft,
        "equipment-shop",
        createInitialEquipmentShopState(
          rng,
          resolveDraftLootProgress(draft),
          draft.runProfile.effects.gearAstralChanceBonus,
          getOwnedUniqueDefinitionIds(snapshotTransactionValue(draft.gear.inventories)),
          modifiers,
          createDraftInstanceIdSource(draft),
        ),
      );
      break;
  }
}

export function initializeAlchemyVisitInTransaction(draft: RunTransaction, kind: "campfire" | "transmutation"): void {
  const visit = readActivityData(snapshotTransactionValue(draft.session.activity), kind);
  if (
    draft.session.activity.kind === kind &&
    (visit.completed || (kind === "campfire" ? visit.offers.length : visit.transmutation))
  )
    return;
  const rng = createDraftRunRandomSource(draft, "events");
  setAlchemyVisit(draft, kind, {
    offers: kind === "campfire" ? createCampfirePotionOffers(rng) : [],
    ...(kind === "transmutation"
      ? {
          transmutation: {
            choices: createTransmutationOffers(snapshotTransactionValue(draft.run.activeRun.runDeck), rng),
            sourceIndex: null,
            source: null,
            keyword: null,
            offerIndex: null,
          },
        }
      : {}),
    result: null,
    original: null,
    completed: false,
  });
}

export function beginMysteryVisitInTransaction(draft: RunTransaction): void {
  clearMysteryVisitState(draft);
  // Shared "events" stream with corruption and run-restore mystery repair:
  // sequential draws stay deterministic for saves, so keep sharing rather
  // than splitting streams.
  const rng = createDraftRunRandomSource(draft, "events");
  const modifiers = activeLabyrinthBenefits(
    draft.run.activeRun.contentSystemType,
    draft.session.activeLabyrinthRewardModifiers,
  );
  const ownedTrinkets = combineTrinketEffectIds(
    draft.run.activeRun.runBoons,
    draft.gear.equippedTrinkets[draft.run.activeRun.characterId],
  );
  const lootProgress = resolveDraftLootProgress(draft);
  setMysteryEvent(
    draft,
    applyLabyrinthMysteryModifiers(
      pickResolvedMysteryEvent(
        rng,
        ownedTrinkets,
        (event) =>
          isLabyrinthMysteryEligible(event, modifiers) && isMysteryLootEligible(event, lootProgress, ownedTrinkets),
      ),
      modifiers,
      draft.run.activeRun.runMaxHealth,
    ),
  );
}
