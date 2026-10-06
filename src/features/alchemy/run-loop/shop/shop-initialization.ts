import { defaultGameSession } from "@/features/alchemy/shared/stores/default-game-session";
import type { GameSession } from "@/features/alchemy/shared/stores/game-session-types";
import { resolveDraftLootProgress } from "@/features/alchemy/shared/stores/loot-progress";
import {
  acceptCommand,
  dispatchRunSessionCommand,
  snapshotTransactionValue,
  type RunTransaction,
} from "@/features/alchemy/shared/stores/run-session-command";
import {
  createDraftInstanceIdSource,
  createDraftRunRandomSource,
  setRunActivityData,
} from "@/features/alchemy/shared/stores/run-session-write-port";
import { getOwnedUniqueDefinitionIds } from "@/lib/gear";
import type { ShopKind } from "./shop-action-types";
import { resolveDraftShopModifiers } from "./shop-pricing-context";
import {
  createInitialShopState,
  createInitialAlchemistState,
  createInitialTrinketShopState,
  createInitialEquipmentShopState,
} from "./shop-state-init";

export function initializeShopVisit(
  draft: RunTransaction,
  kind: ShopKind,
  gearAstralChanceBonus = draft.runProfile.effects.gearAstralChanceBonus,
): void {
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
          gearAstralChanceBonus,
          getOwnedUniqueDefinitionIds(snapshotTransactionValue(draft.gear.inventories)),
          modifiers,
          createDraftInstanceIdSource(draft),
        ),
      );
      break;
  }
}

export function createShopInitializer(
  kind: ShopKind,
  gameSession: GameSession = defaultGameSession,
  gearAstralChanceBonus?: number,
): () => void {
  return () =>
    dispatchRunSessionCommand(
      (draft) => acceptCommand(initializeShopVisit(draft, kind, gearAstralChanceBonus)),
      undefined,
      gameSession,
    );
}
