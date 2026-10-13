import { resolveDraftLootProgress } from "@/features/alchemy/shared/stores/loot-progress";
import { snapshotTransactionValue, type RunTransaction } from "@/features/alchemy/shared/stores/run-session-command";
import {
  clearMysteryVisitState,
  createDraftInstanceIdSource,
  createDraftRunRandomSource,
  setAlchemyVisit,
  setMysteryEvent,
  setRunActivityData,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { createCampfirePotionOffers } from "@/lib/alchemist/brewing";
import { createTransmutationOffers } from "@/lib/alchemist/transmutation";
import {
  activeLabyrinthBenefits,
  applyLabyrinthMysteryModifiers,
  isLabyrinthMysteryEligible,
} from "@/lib/content-systems/labyrinth/room-rules";
import { getOwnedUniqueDefinitionIds } from "@/lib/gear";
import { isMysteryLootEligible, pickResolvedMysteryEvent } from "@/lib/mystery";
import { combineTrinketEffectIds } from "@/lib/trinkets";
import type { ShopKind } from "../shop/shop-action-types";
import { resolveDraftShopModifiers } from "../shop/shop-pricing-context";
import {
  createInitialShopState,
  createInitialAlchemistState,
  createInitialTrinketShopState,
  createInitialEquipmentShopState,
} from "../shop/shop-state-init";

// Room entry owns visit creation; retained UI capabilities only act on committed visits.
export function initializeShopVisit(draft: RunTransaction, kind: ShopKind): void {
  const rng = createDraftRunRandomSource(draft, "shops");
  const modifiers = resolveDraftShopModifiers(draft);
  switch (kind) {
    case "merchant":
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
    case "trinket":
      setRunActivityData(draft, "trinket-shop", createInitialTrinketShopState(rng, draft.gear.ownedTrinketIds));
      break;
    case "equipment":
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
